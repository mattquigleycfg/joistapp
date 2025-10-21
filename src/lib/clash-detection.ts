import { NCCalculations, ProfileData } from '@/types/form-types';
import { getPunchDimensions, getVisualDimensions } from './punch-dimensions';
import { MANUFACTURING_CONSTANTS } from './constants';
import { roundHalf } from './utils/manufacturing';

export type ClashSeverity = 'error' | 'warning';
export type ClashType = 'clearance' | 'overlap' | 'span-limit' | 'position-conflict' | 'alignment';

export interface ClashIssue {
  type: ClashType;
  position: number | null; // null for span limit issues
  element1: string;
  element2: string;
  issue: string;
  severity: ClashSeverity;
}

export interface ClashDetectionResult {
  issues: ClashIssue[];
  errorCount: number;
  warningCount: number;
}

// Utility to round to 0.5mm precision for comparison
// Using shared utility function from manufacturing utils

// Get clearance distance needed for a punch type along the profile length
function getClearanceDistance(punchType: string): number {
  const dimensions = getVisualDimensions(punchType);
  
  // For longitudinal clash detection (along profile length), use WIDTH
  // Height is perpendicular to the profile length and doesn't affect longitudinal spacing
  // For round punches, width = height = diameter, so either works
  return dimensions.width / 2;
}

export function detectClashes(
  calculations: NCCalculations,
  profileData: ProfileData
): ClashDetectionResult {
  const issues: ClashIssue[] = [];
  const profileLength = calculations.lengthMod + calculations.endExclusion;
  const isBearer = profileData.profileType === 'Bearer Single' || profileData.profileType === 'Bearer Box';
  const isJoist = profileData.profileType === 'Joist Single' || profileData.profileType === 'Joist Box';

  // IMPORTANT: Separate punches by physical plane
  // FLANGE PUNCHES (top & bottom flanges): Bolt holes, Dimples
  const flangePunches: Array<{ position: number; type: string; active: boolean }> = [
    ...calculations.boltHoles,
    ...calculations.dimples,
  ];
  
  // FACE PUNCHES (web face): Web tabs, Service holes, Stubs
  const facePunches: Array<{ position: number; type: string; active: boolean }> = [
    ...calculations.webHoles,
    ...calculations.serviceHoles,
    ...calculations.stubs,
  ];

  // 1. Edge Clearance Violations
  
  // 1a. Bolt holes (11mm square) within 50mm of profile ends
  calculations.boltHoles.forEach(bolt => {
    if (!bolt.active) return;
    
    // Check if this is an end bolt (at ~30mm)
    const isEndBolt = bolt.position <= 35 || bolt.position >= profileLength - 35;
    if (isEndBolt) return; // Skip end bolts
    
    if (bolt.position < MANUFACTURING_CONSTANTS.MIN_CLEARANCE) {
      issues.push({
        type: 'clearance',
        position: bolt.position,
        element1: 'Bolt Hole (11mm)',
        element2: 'Profile Start',
        issue: `Bolt hole within ${MANUFACTURING_CONSTANTS.MIN_CLEARANCE}mm of profile end (conflicts with ${MANUFACTURING_CONSTANTS.END_BOLT_POSITION}mm end bolt)`,
        severity: 'error',
      });
    }
    if (bolt.position > profileLength - MANUFACTURING_CONSTANTS.MIN_CLEARANCE) {
      issues.push({
        type: 'clearance',
        position: bolt.position,
        element1: 'Bolt Hole (11mm)',
        element2: 'Profile End',
        issue: `Bolt hole within ${MANUFACTURING_CONSTANTS.MIN_CLEARANCE}mm of profile end (conflicts with end bolt at ${profileLength - MANUFACTURING_CONSTANTS.END_BOLT_POSITION}mm)`,
        severity: 'error',
      });
    }
  });

  // 1b. Web tabs (45mm wide) within 22.5mm of profile ends
  calculations.webHoles.forEach(webTab => {
    if (!webTab.active) return;
    
    const webTabHalfWidth = MANUFACTURING_CONSTANTS.WEB_TAB_CLEARANCE; // 45mm / 2
    
    if (webTab.position < webTabHalfWidth) {
      issues.push({
        type: 'clearance',
        position: webTab.position,
        element1: 'Web Tab (45mm wide)',
        element2: 'Profile Start',
        issue: `Web tab edge extends beyond profile start (center at ${webTab.position}mm, needs ≥${MANUFACTURING_CONSTANTS.WEB_TAB_CLEARANCE}mm)`,
        severity: 'error',
      });
    }
    if (webTab.position > profileLength - webTabHalfWidth) {
      issues.push({
        type: 'clearance',
        position: webTab.position,
        element1: 'Web Tab (45mm wide)',
        element2: 'Profile End',
        issue: `Web tab edge extends beyond profile end (center at ${webTab.position}mm, needs ≤${profileLength - MANUFACTURING_CONSTANTS.WEB_TAB_CLEARANCE}mm)`,
        severity: 'error',
      });
    }
  });

  // 1c. Service holes within their radius of profile ends
  calculations.serviceHoles.forEach(service => {
    if (!service.active) return;
    
    const serviceRadius = getClearanceDistance(service.type);
    
    if (service.position < serviceRadius) {
      issues.push({
        type: 'clearance',
        position: service.position,
        element1: `Service Hole (Ø${serviceRadius * 2}mm)`,
        element2: 'Profile Start',
        issue: `Service hole edge extends beyond profile start (center at ${service.position}mm, needs ≥${serviceRadius}mm)`,
        severity: 'error',
      });
    }
    if (service.position > profileLength - serviceRadius) {
      issues.push({
        type: 'clearance',
        position: service.position,
        element1: `Service Hole (Ø${serviceRadius * 2}mm)`,
        element2: 'Profile End',
        issue: `Service hole edge extends beyond profile end (center at ${service.position}mm, needs ≤${profileLength - serviceRadius}mm)`,
        severity: 'error',
      });
    }
  });

  // 2. Inter-Element Clearances - Using specific formulas
  
  calculations.webHoles.forEach(webTab => {
    if (!webTab.active) return;
    
    calculations.serviceHoles.forEach(service => {
      if (!service.active) return;
      
      const distance = Math.abs(service.position - webTab.position);
      let requiredDistance: number;
      let serviceType: string;
      
      // Calculate required clearance based on service hole type
      if (service.type === 'M SERVICE HOLE') {
        // M SERVICE HOLE (Ø200mm): 45mm/2 + 100mm + 22.5mm buffer = 145mm
        requiredDistance = 145;
        serviceType = 'M SERVICE HOLE (Ø200mm)';
      } else if (service.type === 'LARGE SERVICE HOLE') {
        // LARGE SERVICE HOLE (400×200mm): 45mm/2 + 200mm + 22.5mm buffer = 245mm
        requiredDistance = 245;
        serviceType = 'LARGE SERVICE HOLE (400×200mm)';
      } else if (service.type === 'SMALL SERVICE HOLE') {
        // SMALL SERVICE HOLE (Ø115mm): 45mm/2 + 57.5mm + 22.5mm buffer = 102.5mm
        requiredDistance = 102.5;
        serviceType = 'SMALL SERVICE HOLE (Ø115mm)';
      } else {
        // Generic service hole
        const serviceRadius = getClearanceDistance(service.type);
        requiredDistance = 22.5 + serviceRadius + 22.5; // web tab half + radius + buffer
        serviceType = `Service Hole (Ø${serviceRadius * 2}mm)`;
      }
      
      if (distance < requiredDistance) {
        issues.push({
          type: 'clearance',
          position: webTab.position,
          element1: 'Web Tab (45mm)',
          element2: serviceType,
          issue: `Min ${requiredDistance}mm center-to-center violated (actual: ${Math.round(distance)}mm)`,
          severity: 'warning',
        });
      }
    });
  });

  // 2b. Stub (SERVICE/CORNER BRACKETS) vs any service hole: Min 250mm center-to-center
  calculations.stubs.forEach(stub => {
    if (!stub.active) return;
    
    calculations.serviceHoles.forEach(service => {
      if (!service.active) return;
      
      const distance = Math.abs(stub.position - service.position);
      const requiredDistance = MANUFACTURING_CONSTANTS.SERVICE_CLEARANCE; // Service hole clearance
      
      if (distance < requiredDistance) {
        const serviceSize = getPunchDimensions(service.type)?.diameter || 200;
        issues.push({
          type: 'clearance',
          position: stub.position,
          element1: `${stub.type} (115×300mm)`,
          element2: `Service Hole (Ø${serviceSize}mm)`,
          issue: `Min ${MANUFACTURING_CONSTANTS.SERVICE_CLEARANCE}mm center-to-center violated (actual: ${Math.round(distance)}mm)`,
          severity: 'warning',
        });
      }
    });
  });

  // 3. Bearer bolt hole alignment - Must follow ±29.5mm alternating pattern
  if (isBearer) {
    const sortedWebTabs = calculations.webHoles
      .filter(w => w.active)
      .sort((a, b) => a.position - b.position);
    
    const nonEndBolts = calculations.boltHoles.filter(
      b => b.active && b.position > MANUFACTURING_CONSTANTS.MIN_CLEARANCE && b.position < profileLength - MANUFACTURING_CONSTANTS.MIN_CLEARANCE
    );

    sortedWebTabs.forEach((webTab, index) => {
      const expectedOffset = (index % 2 === 0) ? -29.5 : 29.5;
      const expectedBoltPosition = roundHalf(webTab.position + expectedOffset);
      
      // Check if a bolt exists near this expected position
      const correspondingBolt = nonEndBolts.find(
        b => Math.abs(b.position - expectedBoltPosition) < MANUFACTURING_CONSTANTS.POSITION_TOLERANCE
      );
      
      if (!correspondingBolt) {
        issues.push({
          type: 'alignment',
          position: webTab.position,
          element1: `Web Tab ${index + 1}`,
          element2: 'Missing Bolt Hole',
          issue: `Expected bolt hole at ${expectedBoltPosition}mm (${expectedOffset > 0 ? '+' : ''}${expectedOffset}mm offset)`,
          severity: 'warning',
        });
      }
    });
  }

  // 4. Flange punch conflicts (Bolt Holes vs Dimples)
  // Note: Bolt holes and dimples are on flanges, can only clash with each other
  calculations.dimples.forEach(dimple => {
    if (!dimple.active) return;
    
    const dimpleRadius = 2.5; // 5mm diameter / 2
    
    // Check dimples against bolt holes (both on flanges)
    calculations.boltHoles.forEach(bolt => {
      if (!bolt.active) return;
      
      const distance = Math.abs(dimple.position - bolt.position);
      const boltHalfWidth = 5.5; // 11mm square / 2
      const minGap = 5; // Minimum flange clearance
      const requiredDistance = dimpleRadius + boltHalfWidth + minGap;
      
      if (distance < requiredDistance) {
        issues.push({
          type: 'clearance',
          position: dimple.position,
          element1: 'Dimple (Ø5mm)',
          element2: 'Bolt Hole (11mm)',
          issue: `Flange clash: ${Math.round(distance)}mm apart (requires ${Math.round(requiredDistance)}mm)`,
          severity: 'warning',
        });
      }
    });
  });

  // 5. Bearer bolt hole alignment - Must follow ±29.5mm alternating pattern
  if (isBearer) {
    const sortedWebTabs = calculations.webHoles
      .filter(w => w.active)
      .sort((a, b) => a.position - b.position);
    
    const nonEndBolts = calculations.boltHoles.filter(
      b => b.active && b.position > MANUFACTURING_CONSTANTS.MIN_CLEARANCE && b.position < profileLength - MANUFACTURING_CONSTANTS.MIN_CLEARANCE
    );

    sortedWebTabs.forEach((webTab, index) => {
      const expectedOffset = (index % 2 === 0) ? -29.5 : 29.5;
      const expectedBoltPosition = roundHalf(webTab.position + expectedOffset);
      
      // Check if a bolt exists near this expected position
      const correspondingBolt = nonEndBolts.find(
        b => Math.abs(b.position - expectedBoltPosition) < MANUFACTURING_CONSTANTS.POSITION_TOLERANCE
      );
      
      if (!correspondingBolt) {
        issues.push({
          type: 'alignment',
          position: webTab.position,
          element1: `Web Tab ${index + 1}`,
          element2: 'Missing Bolt Hole',
          issue: `Expected bolt hole at ${expectedBoltPosition}mm (${expectedOffset > 0 ? '+' : ''}${expectedOffset}mm offset from web tab)`,
          severity: 'warning',
        });
      }
    });
  }

  // 6. Spacing Violations
  
  // 6a. Dimples not at 450mm (bearer) or 409.5mm (joist) intervals
  const dimplePositions = calculations.dimples
    .filter(d => d.active)
    .map(d => d.position)
    .sort((a, b) => a - b);
  
  const expectedDimpleSpacing = isBearer ? MANUFACTURING_CONSTANTS.DIMPLE_SPACING_BEARER : MANUFACTURING_CONSTANTS.DIMPLE_SPACING_JOIST;
  const dimpleStart = isBearer ? MANUFACTURING_CONSTANTS.DIMPLE_START_BEARER : MANUFACTURING_CONSTANTS.DIMPLE_START_JOIST;
  
  dimplePositions.forEach((pos, index) => {
    if (index === 0) {
      if (Math.abs(pos - dimpleStart) > 1) {
        issues.push({
          type: 'position-conflict',
          position: pos,
          element1: 'First Dimple',
          element2: 'Expected Start',
          issue: `First dimple should be at ${dimpleStart}mm, found at ${pos}mm`,
          severity: 'warning',
        });
      }
    } else {
      const expectedPos = dimpleStart + (index * expectedDimpleSpacing);
      if (Math.abs(pos - expectedPos) > 1) {
        issues.push({
          type: 'position-conflict',
          position: pos,
          element1: `Dimple ${index + 1}`,
          element2: 'Expected Position',
          issue: `Expected at ${roundHalf(expectedPos)}mm, found at ${pos}mm (${expectedDimpleSpacing}mm spacing required)`,
          severity: 'warning',
        });
      }
    }
  });

  // 6. Span table violations
  if (profileData.kpaRating && isJoist) {
    const spanLength = profileData.length;
    const kpa = profileData.kpaRating;
    
    // Get max limits
    const maxLimit = MANUFACTURING_CONSTANTS.SPAN_LIMITS[kpa];
    
    if (spanLength > maxLimit) {
      issues.push({
        type: 'span-limit',
        position: null,
        element1: 'Profile Length',
        element2: 'kPa Rating',
        issue: `Profile length ${spanLength}mm exceeds maximum ${maxLimit}mm for ${kpa}kPa rating`,
        severity: 'error',
      });
    }
  }

  // For bearers, check joist length against span table
  if (profileData.kpaRating && isBearer && profileData.joistLength) {
    const joistLength = profileData.joistLength;
    const kpa = profileData.kpaRating;
    
    const maxLimit = MANUFACTURING_CONSTANTS.SPAN_LIMITS[kpa];
    
    if (joistLength > maxLimit) {
      issues.push({
        type: 'span-limit',
        position: null,
        element1: 'Joist Length',
        element2: 'kPa Rating',
        issue: `Joist length ${joistLength}mm exceeds maximum ${maxLimit}mm for ${kpa}kPa rating`,
        severity: 'warning',
      });
    }
  }

  // 7. Web tab spacing - Use configured joist spacing, not hard-coded minimums
  const webTabPositions = calculations.webHoles
    .filter(w => w.active)
    .map(w => w.position)
    .sort((a, b) => a - b);

  // Expected spacing is the configured joist spacing
  const expectedWebTabSpacing = profileData.joistSpacing;
  const tolerance = Math.max(expectedWebTabSpacing * MANUFACTURING_CONSTANTS.SPACING_TOLERANCE_PERCENT, MANUFACTURING_CONSTANTS.MIN_SPACING_TOLERANCE);

  for (let i = 0; i < webTabPositions.length - 1; i++) {
    const spacing = webTabPositions[i + 1] - webTabPositions[i];
    const deviation = Math.abs(spacing - expectedWebTabSpacing);
    
    // Only flag if spacing deviates significantly from configured value
    if (deviation > tolerance) {
      issues.push({
        type: 'clearance',
        position: webTabPositions[i],
        element1: `Web Tab ${i + 1}`,
        element2: `Web Tab ${i + 2}`,
        issue: `Spacing ${Math.round(spacing)}mm deviates from configured ${expectedWebTabSpacing}mm (tolerance: ±${Math.round(tolerance)}mm)`,
        severity: 'warning',
      });
    }
  }

  // 8. Service hole spacing validation
  // Note: First and last SERVICE holes (at 131mm from ends) are corner brackets - exclude from spacing checks
  const servicePositions = calculations.serviceHoles
    .filter(s => s.active)
    .map(s => s.position)
    .sort((a, b) => a - b);

  // Skip spacing checks in Screens mode (variable spacing is expected between web tabs)
  // Also skip if we have corner bracket service holes (at 131 and length-131)
  if (!profileData.screensEnabled && servicePositions.length > 1) {
    // Filter out corner bracket positions (131mm from each end)
    const nonCornerServicePositions = servicePositions.filter(
      pos => pos > 150 && pos < profileLength - 150
    );
    
    // Only check spacing if we have actual service holes (not just corner brackets)
    if (nonCornerServicePositions.length > 1) {
      for (let i = 0; i < nonCornerServicePositions.length - 1; i++) {
        const spacing = nonCornerServicePositions[i + 1] - nonCornerServicePositions[i];
        const expectedSpacing = MANUFACTURING_CONSTANTS.SERVICE_HOLE_SPACING;
        
        // Allow tolerance on service hole spacing
        if (Math.abs(spacing - expectedSpacing) > MANUFACTURING_CONSTANTS.MIN_SPACING_TOLERANCE) {
          issues.push({
            type: 'position-conflict',
            position: nonCornerServicePositions[i],
            element1: `Service Hole ${i + 1}`,
            element2: `Service Hole ${i + 2}`,
            issue: `Spacing ${Math.round(spacing)}mm deviates from standard ${expectedSpacing}mm (±${MANUFACTURING_CONSTANTS.MIN_SPACING_TOLERANCE}mm tolerance)`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // 9. Face punch overlap detection - Only check face punches against each other
  // Note: Stubs, web tabs, and service holes are all on the web face and CAN clash
  for (let i = 0; i < facePunches.length; i++) {
    const punch1 = facePunches[i];
    if (!punch1.active) continue;
    
    const clearance1 = getClearanceDistance(punch1.type);
    
    for (let j = i + 1; j < facePunches.length; j++) {
      const punch2 = facePunches[j];
      if (!punch2.active) continue;
      
      const distance = Math.abs(punch1.position - punch2.position);
      const clearance2 = getClearanceDistance(punch2.type);
      const minSeparation = MANUFACTURING_CONSTANTS.POSITION_TOLERANCE; // Minimum edge separation on web face
      const requiredDistance = clearance1 + clearance2 + minSeparation;
      
      // Check for physical overlap on web face
      if (distance < requiredDistance) {
        // Get actual dimensions for better messaging
        const dims1 = getPunchDimensions(punch1.type);
        const dims2 = getPunchDimensions(punch2.type);
        
        const desc1 = dims1?.diameter ? `Ø${dims1.diameter}mm` : 
                     dims1 ? `${dims1.width}×${dims1.height}mm` : punch1.type;
        const desc2 = dims2?.diameter ? `Ø${dims2.diameter}mm` : 
                     dims2 ? `${dims2.width}×${dims2.height}mm` : punch2.type;
        
        issues.push({
          type: 'overlap',
          position: punch1.position,
          element1: `${punch1.type} (${desc1})`,
          element2: `${punch2.type} (${desc2})`,
          issue: `Web face overlap: ${Math.round(distance)}mm apart (requires ${Math.round(requiredDistance)}mm)`,
          severity: distance < 5 ? 'error' : 'warning',
        });
      }
    }
  }

  // Count by severity
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    issues,
    errorCount,
    warningCount,
  };
}

