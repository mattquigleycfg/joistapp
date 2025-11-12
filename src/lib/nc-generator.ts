import {
  PlatformData,
  ProfileData,
  ExportData,
  NCCalculations,
  PunchStationType,
} from '@/types/form-types';
import { PunchStationConfig } from '@/types/manufacturing';
import { MANUFACTURING_CONSTANTS } from './constants';
import { roundHalf, calculateBoltOffset, isBearerProfile, isJoistProfile } from './utils/manufacturing';

interface Punch {
  position: number;
  type: PunchStationType;
  active: boolean;
}

export class NCFileGenerator {
  private calculations: NCCalculations;
  private partCode = '';
  private quantity = 1;
  private manualPunches: Punch[] | null = null;
  private isManualMode = false;
  private updateVersion = 0; // Track updates to force re-renders

  constructor() {
    this.calculations = this.initializeCalculations();
  }
  
  setManualPunches(punches: Punch[] | null, profileType?: string) {
    if (!punches) {
      // Clear manual mode when punches are reset
      this.manualPunches = null;
      this.isManualMode = false;
      this.updateVersion++;
      return;
    }
    
    this.manualPunches = punches;
    this.isManualMode = true;
    this.updateVersion++;
    
    // Clear existing calculations and apply manual punches
    this.calculations.boltHoles = [];
    this.calculations.webHoles = [];
    this.calculations.serviceHoles = [];
    this.calculations.dimples = [];
    this.calculations.stubs = [];
    
    // Convert manual punches to calculation format
    punches.forEach(punch => {
      const punchData = { position: punch.position, active: punch.active, type: punch.type };
      
      switch(punch.type) {
        case 'BOLT HOLE':
          this.calculations.boltHoles.push(punchData);
          break;
        case 'WEB TAB':
          this.calculations.webHoles.push(punchData);
          break;
        case 'M SERVICE HOLE':
        case 'SMALL SERVICE HOLE':
        case 'LARGE SERVICE HOLE':
          this.calculations.serviceHoles.push(punchData);
          break;
        case 'DIMPLE':
          this.calculations.dimples.push(punchData);
          break;
        case 'SERVICE':
        case 'CORNER BRACKETS':
          // Both SERVICE and CORNER BRACKETS go to stubs array  
          this.calculations.stubs.push(punchData);
          break;
      }
    });
    
    // For bearers, maintain bolt/web tab relationship
    if (profileType && (profileType === 'Bearer Single' || profileType === 'Bearer Box')) {
      this.syncBearerBoltHolesWithWebTabs();
    }
  }
  
  private syncBearerBoltHolesWithWebTabs() {
    // Get all web tab positions, sorted by position
    const webTabPositions = this.calculations.webHoles
      .filter(w => w.active)
      .map(w => w.position)
      .sort((a, b) => a - b); // Sort to ensure consistent alternating pattern
    
    // Calculate actual profile length from stored calculations
    const profileLength = this.calculations.lengthMod + this.calculations.endExclusion;
    
    // Keep track of existing bolt holes at ends (typically 30mm from ends)
    const endBoltHoles = this.calculations.boltHoles.filter(b => 
      b.position <= 50 || b.position >= (profileLength - 50)
    );
    
    // Start with end bolt holes
    const validBoltHoles = [...endBoltHoles];
    
    // Add bolt holes for each web tab position with alternating ±29.5mm offset
    // Pattern: position 1: -29.5, position 2: +29.5, position 3: -29.5, etc.
    webTabPositions.forEach((webPos, index) => {
      // Alternate: even index (0,2,4...) = -29.5, odd index (1,3,5...) = +29.5
      const offset = (index % 2 === 0) ? -29.5 : 29.5;
      const boltHolePosition = webPos + offset;
      
      // Only add if position is valid (not too close to ends, avoid overlap with end bolts)
      if (boltHolePosition > 50 && boltHolePosition < (profileLength - 50)) {
        validBoltHoles.push({
          position: roundHalf(boltHolePosition),
          active: true,
          type: 'BOLT HOLE'
        });
      }
    });
    
    // Replace bolt holes with the new coordinated set
    this.calculations.boltHoles = validBoltHoles;
  }
  
  clearManualMode() {
    this.manualPunches = null;
    this.isManualMode = false;
    this.updateVersion++;
  }
  
  getUpdateVersion() {
    return this.updateVersion;
  }

  private initializeCalculations(): NCCalculations {
    return {
      boltHoles: [],
      webHoles: [],
      serviceHoles: [],
      dimples: [],
      stubs: [],
      endExclusion: 0,
      lengthMod: 0,
      openingCentres: MANUFACTURING_CONSTANTS.SERVICE_HOLE_SPACING,
      holeQty: 0,
      tabOffset: 0,
      flange: MANUFACTURING_CONSTANTS.FLANGE_HEIGHT,
      thickness: MANUFACTURING_CONSTANTS.PROFILE_THICKNESS,
      holeDia: MANUFACTURING_CONSTANTS.DEFAULT_HOLE_DIAMETER,
      holeEdgeDistance: MANUFACTURING_CONSTANTS.DEFAULT_HOLE_EDGE_DISTANCE
    };
  }

  updateCalculations(_platformData: PlatformData, profileData: ProfileData, exportData: ExportData) {
    const length = profileData.length;
    const profileType = profileData.profileType;
    const joistSpacing = profileData.joistSpacing;
    const holeType = profileData.holeType;
    const screensEnabled = profileData.screensEnabled || false;

    // Store quantity for CSV generation
    this.quantity = exportData.quantity || 1;

    // Use program name from export data as part code, or generate a basic one as fallback
    if (exportData.programName) {
      this.partCode = exportData.programName;
    } else {
      // Fallback: Generate a basic part code: e.g., B_J450_12000_A
      const prefix = isBearerProfile(profileType) ? 'B' : 'J';
      this.partCode = `${prefix}_${profileData.profileHeight}_${length}_A`;
    }

    // Update basic parameters
    this.calculations.thickness = MANUFACTURING_CONSTANTS.PROFILE_THICKNESS;
    this.calculations.flange = isJoistProfile(profileType) 
      ? MANUFACTURING_CONSTANTS.JOIST_FLANGE_HEIGHT 
      : MANUFACTURING_CONSTANTS.FLANGE_HEIGHT;

    // Calculate hole diameter based on type
    this.calculations.holeDia = this.getHoleDiameter(holeType);
    
    // Calculate end exclusion
    this.calculations.endExclusion = ((this.calculations.holeDia / 2) + MANUFACTURING_CONSTANTS.END_EXCLUSION_BASE) * 2;
    this.calculations.lengthMod = length - this.calculations.endExclusion;

    // Set hole edge distance and opening centres
    if (isJoistProfile(profileType)) {
      this.calculations.holeEdgeDistance = this.calculations.endExclusion / 2;
      this.calculations.openingCentres = MANUFACTURING_CONSTANTS.SERVICE_HOLE_SPACING;
    } else {
      this.calculations.holeEdgeDistance = MANUFACTURING_CONSTANTS.DEFAULT_HOLE_EDGE_DISTANCE;
      this.calculations.openingCentres = MANUFACTURING_CONSTANTS.SERVICE_HOLE_SPACING;
    }

    // Use user-supplied hole spacing (default to service hole spacing if absent)
    const desiredSpacing = profileData.holeSpacing || MANUFACTURING_CONSTANTS.SERVICE_HOLE_SPACING;

    // Calculate evenly distributed holes based on desired spacing while keeping symmetry
    let spaces = Math.floor(this.calculations.lengthMod / desiredSpacing);
    if (spaces < 1) {
      // Length shorter than desired spacing – single central hole
      this.calculations.holeQty = 1;
      this.calculations.openingCentres = desiredSpacing;
    } else {
      // Evenly distribute by recalculating opening centres so that start/end offsets are equal
      this.calculations.holeQty = spaces + 1;
      this.calculations.openingCentres = this.calculations.lengthMod / spaces;
    }

    // Calculate tab offset
    this.calculations.tabOffset = isJoistProfile(profileType)
      ? (this.calculations.endExclusion / 2) + (this.calculations.openingCentres * 2) - (this.calculations.openingCentres / 2)
      : joistSpacing;

    // Only generate automatic hole positions if not in manual mode
    if (!this.isManualMode) {
      // Generate hole positions (pass stub positions for bearer and screens mode flag)
      this.generateHolePositions(
        profileType,
        length,
        joistSpacing,
        holeType,
        profileData.stubPositions,
        profileData.stubsEnabled,
        profileData.endBoxJoist,
        profileData.punchStations,
        screensEnabled,
        profileData.joistBox,
      );
    } else {
      // In manual mode, preserve manual punches but update version to trigger re-renders
      this.updateVersion++;
    }
  }

  private getHoleDiameter(holeType: string): number {
    switch (holeType) {
      case '50mm': return 50;
      case '200mm':
      case '200 Round': return 200;
      case '110 Round': return 110;
      case '200mm x 400mm':
      case '200 x 400 Oval': return 400; // Use width (400mm) for oval holes
      case '115 Round':
      case '115mm':
        return 115;
      default: return MANUFACTURING_CONSTANTS.DEFAULT_HOLE_DIAMETER;
    }
  }

  private getServiceHoleType(holeType: string): PunchStationType {
    switch (holeType) {
      case '115 Round':
      case '115mm':
        return 'SMALL SERVICE HOLE';
      case '200mm x 400mm':
      case '200 x 400 Oval':
        return 'LARGE SERVICE HOLE';
      case '200mm':
      case '200 Round':
      default:
        return 'M SERVICE HOLE';
    }
  }

  private generateHolePositions(
    profileType: string,
    length: number,
    joistSpacing: number,
    holeType: string,
    stubPositions?: number[],
    stubsEnabled?: boolean,
    endBox?: boolean,
    punchStations?: any[],
    screensEnabled?: boolean,
    joistBox?: boolean,
  ) {
    // Clear existing holes
    this.calculations.boltHoles = [];
    this.calculations.webHoles = [];
    this.calculations.serviceHoles = [];
    this.calculations.dimples = [];
    this.calculations.stubs = [];

    if (isBearerProfile(profileType)) {
      if (screensEnabled) {
        this.generateScreensBearerHoles(length, joistSpacing, holeType, stubPositions, stubsEnabled, punchStations, joistBox);
      } else {
        this.generateBearerHoles(length, joistSpacing, holeType, stubPositions, stubsEnabled, punchStations, joistBox);
      }
    } else {
      // For Joist Single and Joist Box
      const useEndBox = profileType === 'Joist Box';
      if (screensEnabled) {
        this.generateScreensJoistHoles(length, joistSpacing, holeType, useEndBox, punchStations);
      } else {
        this.generateJoistHoles(length, holeType, useEndBox, punchStations);
      }
    }
  }

  private generateBearerHoles(
    length: number,
    joistSpacing: number,
    holeType: string,
    stubPositions?: number[],
    stubsEnabled?: boolean,
    punchStations?: PunchStationConfig[],
    joistBox?: boolean,
  ) {
    // Check if punch types are enabled
    const isBoltHoleEnabled = !punchStations || punchStations.some(ps => ps.station === 'BOLT HOLE' && ps.enabled);
    const isServiceEnabled = !punchStations || punchStations.some(ps => ps.station === 'SERVICE' && ps.enabled);
    
    // End bolt holes: always at 30 mm from ends (if enabled) - skip in joistBox mode as they become dimples
    if (isBoltHoleEnabled && !joistBox) {
      this.calculations.boltHoles.push({ position: MANUFACTURING_CONSTANTS.END_BOLT_POSITION, active: true, type: 'BOLT HOLE' });
      this.calculations.boltHoles.push({ position: length - MANUFACTURING_CONSTANTS.END_BOLT_POSITION, active: true, type: 'BOLT HOLE' });
    }

    // Check if dimples are enabled
    const isDimpleEnabled = !punchStations || punchStations.some(ps => ps.station === 'DIMPLE' && ps.enabled);
    
    // Dimples: every 450 mm CTS starting from 479.5 mm (if enabled)
    if (isDimpleEnabled) {
      for (let pos = MANUFACTURING_CONSTANTS.DIMPLE_START_BEARER; pos <= length - 270.5; pos += MANUFACTURING_CONSTANTS.DIMPLE_SPACING_BEARER) {
        this.calculations.dimples.push({ position: pos, active: true, type: 'DIMPLE' });
      }
    }

    // JOIST BOX MODE: Double SERVICE punches at joist positions (±12mm), dimples instead of bolt holes
    if (joistBox && isServiceEnabled) {
      // End dimples: convert end bolt holes to dimples in joistBox mode
      const isDimpleEnabled = !punchStations || punchStations.some(ps => ps.station === 'DIMPLE' && ps.enabled);
      if (isDimpleEnabled) {
        this.calculations.dimples.push({ position: MANUFACTURING_CONSTANTS.END_BOLT_POSITION, active: true, type: 'DIMPLE' });
        this.calculations.dimples.push({ position: length - MANUFACTURING_CONSTANTS.END_BOLT_POSITION, active: true, type: 'DIMPLE' });
      }
      
      // Calculate joist positions starting from first joist spacing
      const startOffset = joistSpacing;
      const endOffset = length - joistSpacing;
      
      // Generate joist positions
      let currentPos = startOffset;
      while (currentPos <= endOffset) {
        // Double SERVICE hits: +12mm and -12mm only (center removed)
        this.calculations.stubs.push({ position: roundHalf(currentPos - 12), active: true, type: 'SERVICE' });
        this.calculations.stubs.push({ position: roundHalf(currentPos + 12), active: true, type: 'SERVICE' });
        
        // Dimple at exact joist position (centered, no offset) - replaces bolt hole
        if (isDimpleEnabled && currentPos > MANUFACTURING_CONSTANTS.MIN_CLEARANCE && currentPos < (length - MANUFACTURING_CONSTANTS.MIN_CLEARANCE)) {
          this.calculations.dimples.push({ 
            position: roundHalf(currentPos), 
            active: true, 
            type: 'DIMPLE' 
          });
        }
        
        currentPos += joistSpacing;
      }
      
      // Corner brackets - always at 131mm from ends for bearers
      this.calculations.stubs.push({ position: 131, active: true, type: 'SERVICE' });
      this.calculations.stubs.push({ position: length - 131, active: true, type: 'SERVICE' });
      
      // In joistBox mode, web tabs are suppressed and bolt holes are replaced with dimples
    } else {
      // NORMAL MODE: Generate coordinated holes (web tabs and service holes)
      this.generateCoordinatedBearerHoles(length, joistSpacing, holeType, punchStations);
      
      // After web tabs are generated, add corresponding bolt holes (if bolt holes are enabled)
      // Bolt holes should be offset ±29.5mm from web tab positions (alternating pattern)
      if (isBoltHoleEnabled) {
        // Sort web tabs by position for consistent alternating pattern
        const sortedWebTabs = this.calculations.webHoles
          .filter(w => w.active)
          .sort((a, b) => a.position - b.position);
        
        sortedWebTabs.forEach((webTab, index) => {
          // Alternate: even index (0,2,4...) = -29.5, odd index (1,3,5...) = +29.5
          const offset = calculateBoltOffset(index);
          const expectedBoltPosition = webTab.position + offset;
          
          // Check if a bolt hole already exists near this position (within tolerance)
          const existingBolt = this.calculations.boltHoles.some(bolt => 
            Math.abs(bolt.position - expectedBoltPosition) < MANUFACTURING_CONSTANTS.POSITION_TOLERANCE
          );
          
          // Only add if not too close to ends (avoid overlap with end bolt holes)
          if (!existingBolt && expectedBoltPosition > MANUFACTURING_CONSTANTS.MIN_CLEARANCE && expectedBoltPosition < (length - MANUFACTURING_CONSTANTS.MIN_CLEARANCE)) {
            this.calculations.boltHoles.push({ 
              position: roundHalf(expectedBoltPosition), 
              active: true, 
              type: 'BOLT HOLE' 
            });
          }
        });
      }

      // SERVICE punches for normal mode
      if (isServiceEnabled) {
        // Corner brackets - always at 131mm from ends for bearers
        this.calculations.stubs.push({ position: 131, active: true, type: 'SERVICE' });
        this.calculations.stubs.push({ position: length - 131, active: true, type: 'SERVICE' });
        
        // Service stubs - using calculated positions from stubPositions
        if (stubPositions && stubPositions.length) {
          stubPositions.forEach((pos) => {
            // Add all stub positions (they should include 331, length-331, and intermediate positions)
            if (pos > 0 && pos < length) {
              this.calculations.stubs.push({ position: pos, active: true, type: 'SERVICE' });
            }
          });
        }
      }
    }
  }

  private generateJoistHoles(length: number, holeType: string, endBox?: boolean, punchStations?: any[]) {
    // Check if punch types are enabled
    const isBoltHoleEnabled = !punchStations || punchStations.some(ps => ps.station === 'BOLT HOLE' && ps.enabled);
    const isDimpleEnabled = !punchStations || punchStations.some(ps => ps.station === 'DIMPLE' && ps.enabled);
    
    // Joist bolt holes at 30 mm from ends (if enabled)
    if (isBoltHoleEnabled) {
      this.calculations.boltHoles.push({ position: 30, active: true, type: 'BOLT HOLE' });
      this.calculations.boltHoles.push({ position: length - 30, active: true, type: 'BOLT HOLE' });
    }

    // Dimples: 600mm intervals with ±75mm offsets (if enabled)
    if (isDimpleEnabled) {
      // First dimple at 75mm
      this.calculations.dimples.push({ position: 75, active: true, type: 'DIMPLE' });
      
      // Paired dimples at 600mm intervals: -75 and +75 from base positions
      for (let basePos = 600; basePos < length - 75; basePos += 600) {
        // Dimple before base position (-75)
        this.calculations.dimples.push({ position: basePos - 75, active: true, type: 'DIMPLE' });
        // Dimple after base position (+75)
        if (basePos + 75 < length - 75) {
          this.calculations.dimples.push({ position: basePos + 75, active: true, type: 'DIMPLE' });
        }
      }
      
      // End dimple at length - 75
      this.calculations.dimples.push({ position: length - 75, active: true, type: 'DIMPLE' });
    }

    // Generate coordinated holes to prevent clashes
    this.generateCoordinatedJoistHoles(length, holeType, punchStations);

    // For joists, bolt holes are centered at web tab positions (no offset)
    if (isBoltHoleEnabled) {
      const webTabPositions = this.calculations.webHoles
        .filter(w => w.active)
        .map(w => w.position);
      
      webTabPositions.forEach(webPos => {
        // Check if bolt hole already exists at this position
        const existingBolt = this.calculations.boltHoles.some(bolt => 
          Math.abs(bolt.position - webPos) < MANUFACTURING_CONSTANTS.POSITION_TOLERANCE
        );
        
        // Add bolt hole centered at web tab position (no offset for joists)
        if (!existingBolt && webPos > 50 && webPos < (length - 50)) {
          this.calculations.boltHoles.push({ 
            position: roundHalf(webPos), 
            active: true, 
            type: 'BOLT HOLE' 
          });
        }
      });
    }

    // Check if CORNER BRACKETS is enabled in punch stations
    const isCornerBracketsEnabled = !punchStations || punchStations.some(ps => ps.station === 'CORNER BRACKETS' && ps.enabled);
    
    // Corner bracket punches at 131mm from each end
    if (isCornerBracketsEnabled) {
      this.calculations.stubs.push({ position: 131, active: true, type: 'CORNER BRACKETS' });
      this.calculations.stubs.push({ position: length - 131, active: true, type: 'CORNER BRACKETS' });
    }
  }

  private generateCoordinatedJoistHoles(length: number, holeType: string, punchStations?: any[]) {
    // Check if punch types are enabled
    const isWebTabEnabled = !punchStations || punchStations.some(ps => ps.station === 'WEB TAB' && ps.enabled);
    const isServiceHoleEnabled = !punchStations || punchStations.some(ps => 
      (ps.station === 'M SERVICE HOLE' || ps.station === 'SMALL SERVICE HOLE' || ps.station === 'LARGE SERVICE HOLE') && ps.enabled
    );
    
    
    // If web tabs are disabled, don't generate them
    if (!isWebTabEnabled) {
      return;
    }
    
    // Calculate available length (excluding end exclusions)
    const availableLength = length - this.calculations.endExclusion;
    const startOffset = this.calculations.endExclusion / 2;
    
    // Define spacing requirements with tolerance
    const serviceHoleSpacing = this.calculations.openingCentres; // 650mm
    const minWebTabSpacing = 1000; // 1200mm - 200mm tolerance = 1000mm minimum
    const maxWebTabSpacing = 2600; // 2400mm + 200mm tolerance = 2600mm maximum
    
    // Generate service holes first (if enabled and not "No Holes")
    if (holeType !== 'No Holes' && isServiceHoleEnabled) {
      this.generateServiceHolesWithWebTabs(
        startOffset, 
        startOffset + availableLength, 
        serviceHoleSpacing,
        minWebTabSpacing,
        maxWebTabSpacing,
        punchStations,
        holeType
      );
    } else if (isWebTabEnabled) {
      // No service holes, generate web tabs with minimum spacing (if enabled)
      this.generateWebTabsOnly(
        startOffset,
        startOffset + availableLength,
        minWebTabSpacing,
        maxWebTabSpacing
      );
    }
    
    
  }

  private generateServiceHolesWithWebTabs(
    startPos: number,
    endPos: number,
    serviceHoleSpacing: number,
    minWebTabSpacing: number,
    maxWebTabSpacing: number,
    punchStations?: any[],
    holeType?: string
  ) {
    // Check if web tabs are enabled
    const isWebTabEnabled = !punchStations || punchStations.some(ps => ps.station === 'WEB TAB' && ps.enabled);
    
    const availableLength = endPos - startPos;
    
    // Calculate how many service holes we can fit
    const maxServiceHoles = Math.floor(availableLength / serviceHoleSpacing);
    
    if (maxServiceHoles < 1) return;
    
    // Generate service holes symmetrically
    const totalServiceSpan = (maxServiceHoles - 1) * serviceHoleSpacing;
    const serviceStart = startPos + (availableLength - totalServiceSpan) / 2;
    
    const servicePositions: number[] = [];
    const serviceHoleType = this.getServiceHoleType(holeType || '200mm');
    for (let i = 0; i < maxServiceHoles; i++) {
      const position = serviceStart + (i * serviceHoleSpacing);
      servicePositions.push(roundHalf(position));
      this.calculations.serviceHoles.push({ position: roundHalf(position), active: true, type: serviceHoleType });
    }
    
    // Generate web tabs between service holes with minimum spacing (if enabled)
    if (isWebTabEnabled) {
      this.generateWebTabsBetweenServiceHoles(servicePositions, minWebTabSpacing, maxWebTabSpacing);
    }
  }

  private generateWebTabsBetweenServiceHoles(servicePositions: number[], minWebTabSpacing: number, maxWebTabSpacing: number) {
    if (servicePositions.length === 0) {
      return;
    }
    
    // For joists: Place web tabs (lateral bracing) at proper 1200-2400mm spacing
    // Service holes: 200mm diameter at 650mm spacing, Web tabs: 40mm wide
    // Safe clearance: 150mm from service hole center (100mm radius + 20mm web tab half-width + 30mm safety margin)
    const startPos = servicePositions[0];
    const endPos = servicePositions[servicePositions.length - 1];
    const availableLength = endPos - startPos;
    
    const minClearance = 150; // 100mm service hole radius + 20mm web tab half-width + 30mm safety margin
    
    // If span is too small, don't add web tabs
    if (availableLength < minWebTabSpacing) {
      return;
    }
    
    // Calculate how many web tabs we need based on MAX spacing (2400mm)
    // This ensures we don't exceed the maximum allowed spacing
    const minWebTabs = Math.ceil(availableLength / maxWebTabSpacing);
    
    // Calculate ideal even spacing for web tabs
    const idealSpacing = availableLength / (minWebTabs + 1);
    
    const webTabPositions: number[] = [];
    
    // Generate web tabs at ideal spacing, adjusting for service holes
    for (let i = 1; i <= minWebTabs; i++) {
      const idealPosition = startPos + (i * idealSpacing);
      
      // Check clearance from all service holes
      const hasClearance = servicePositions.every(servicePos => 
        Math.abs(idealPosition - servicePos) >= minClearance
      );
      
      if (hasClearance) {
        // Ideal position is safe - use it
        webTabPositions.push(idealPosition);
      } else {
        // Position conflicts with service hole - need to adjust
        
        // Find the nearest service hole causing the conflict
        const conflictingHole = servicePositions.reduce((nearest, servicePos) => {
          const currentDist = Math.abs(idealPosition - servicePos);
          const nearestDist = Math.abs(idealPosition - nearest);
          return currentDist < nearestDist ? servicePos : nearest;
        });
        
        // Try to center between service holes near the ideal position
        let bestPosition: number | null = null;
        let bestScore = Infinity; // Lower is better (closer to ideal)
        
        // Check gaps between adjacent service holes
        for (let j = 0; j < servicePositions.length - 1; j++) {
          const leftService = servicePositions[j];
          const rightService = servicePositions[j + 1];
          const gapCenter = (leftService + rightService) / 2;
          
          // Check if this gap center is safe and reasonably close to ideal position
          const clearanceFromLeft = gapCenter - leftService;
          const clearanceFromRight = rightService - gapCenter;
          
          if (clearanceFromLeft >= minClearance && clearanceFromRight >= minClearance) {
            const distanceFromIdeal = Math.abs(gapCenter - idealPosition);
            
            // Only consider if within reasonable range (within 1 service hole spacing)
            if (distanceFromIdeal < 650 && distanceFromIdeal < bestScore) {
              // Check it's not too close to existing web tabs
              const tooClose = webTabPositions.some(pos => Math.abs(pos - gapCenter) < minWebTabSpacing * 0.8);
              if (!tooClose) {
                bestPosition = gapCenter;
                bestScore = distanceFromIdeal;
              }
            }
          }
        }
        
        // If centered position found, use it
        if (bestPosition !== null) {
          webTabPositions.push(bestPosition);
        } else {
          // Fallback: Try shifting left or right of conflicting hole
          const shiftedRight = conflictingHole + minClearance;
          const shiftedLeft = conflictingHole - minClearance;
          
          const rightHasClearance = shiftedRight <= endPos && 
            servicePositions.every(sp => Math.abs(shiftedRight - sp) >= minClearance) &&
            !webTabPositions.some(pos => Math.abs(pos - shiftedRight) < minWebTabSpacing * 0.8);
          
          const leftHasClearance = shiftedLeft >= startPos && 
            servicePositions.every(sp => Math.abs(shiftedLeft - sp) >= minClearance) &&
            !webTabPositions.some(pos => Math.abs(pos - shiftedLeft) < minWebTabSpacing * 0.8);
          
          // Choose the shift closest to ideal position
          if (rightHasClearance && (!leftHasClearance || Math.abs(shiftedRight - idealPosition) <= Math.abs(shiftedLeft - idealPosition))) {
            webTabPositions.push(shiftedRight);
          } else if (leftHasClearance) {
            webTabPositions.push(shiftedLeft);
          }
          // If neither works, skip this web tab (acceptable if spacing requirements still met)
        }
      }
    }
    
    // Add all positioned web tabs to calculations
    webTabPositions.forEach(pos => {
      this.calculations.webHoles.push({ position: roundHalf(pos), active: true, type: 'WEB TAB' });
    });
  }

  private generateJoistWebTabs(startPos: number, endPos: number, minSpacing: number, maxSpacing: number) {
    const availableLength = endPos - startPos;
    const serviceHoleRadius = 100; // 200mm diameter = 100mm radius
    const minClearance = 200; // Minimum 200mm from service hole edge
    const tolerance = 200; // ±200mm tolerance for spacing
    
    // Get existing service hole positions
    const servicePositions = this.calculations.serviceHoles.map(h => h.position);
    
    // Calculate how many web tabs we can fit with minimum spacing
    const maxWebTabs = Math.floor(availableLength / minSpacing);
    
    if (maxWebTabs < 1) return;
    
    // Generate web tabs with clearance from service holes
    const totalSpan = (maxWebTabs - 1) * minSpacing;
    const centerStart = startPos + (availableLength - totalSpan) / 2;
    
    for (let i = 0; i < maxWebTabs; i++) {
      const idealPosition = centerStart + (i * minSpacing);
      
      // Check if this position conflicts with service holes
      const hasConflict = servicePositions.some(servicePos => 
        Math.abs(idealPosition - servicePos) < (serviceHoleRadius + minClearance)
      );
      
      if (!hasConflict) {
        // No conflict, use ideal position
        this.calculations.webHoles.push({ position: roundHalf(idealPosition), active: true, type: 'WEB TAB' });
      } else {
        // Find alternative position with clearance
        const alternativePosition = this.findAlternativeWebTabPosition(
          idealPosition, 
          servicePositions, 
          serviceHoleRadius + minClearance,
          startPos,
          endPos,
          tolerance
        );
        
        if (alternativePosition !== null) {
          this.calculations.webHoles.push({ position: roundHalf(alternativePosition), active: true, type: 'WEB TAB' });
        }
      }
    }
  }

  private findAlternativeWebTabPosition(
    idealPos: number, 
    servicePositions: number[], 
    minDistance: number,
    startPos: number,
    endPos: number,
    tolerance: number
  ): number | null {
    // Try positions within tolerance range
    for (let offset = 0; offset <= tolerance; offset += 50) {
      // Try positive offset
      const pos1 = idealPos + offset;
      if (pos1 <= endPos && this.isPositionClear(pos1, servicePositions, minDistance)) {
        return pos1;
      }
      
      // Try negative offset
      const pos2 = idealPos - offset;
      if (pos2 >= startPos && this.isPositionClear(pos2, servicePositions, minDistance)) {
        return pos2;
      }
    }
    
    return null; // No suitable position found
  }

  private isPositionClear(position: number, servicePositions: number[], minDistance: number): boolean {
    return !servicePositions.some(servicePos => 
      Math.abs(position - servicePos) < minDistance
    );
  }

  private generateWebTabsOnly(startPos: number, endPos: number, minSpacing: number, maxSpacing: number) {
    const availableLength = endPos - startPos;
    
    // console.log('generateWebTabsOnly:', { startPos, endPos, availableLength, minSpacing, maxSpacing });
    
    // Calculate optimal number of web tabs to stay within spacing constraints
    const minWebTabs = Math.ceil(availableLength / maxSpacing);
    const maxWebTabs = Math.floor(availableLength / minSpacing);
    
    // Use the minimum number that satisfies max spacing constraint
    const numWebTabs = Math.max(1, minWebTabs);
    
    // console.log('Calculated web tabs:', { minWebTabs, maxWebTabs, numWebTabs });
    
    if (numWebTabs < 1) return;
    
    // Calculate actual spacing (will be between minSpacing and maxSpacing)
    const actualSpacing = availableLength / (numWebTabs + 1);
    
    // console.log('actualSpacing:', actualSpacing);
    
    // Generate web tabs symmetrically with calculated spacing
    for (let i = 1; i <= numWebTabs; i++) {
      const position = startPos + (i * actualSpacing);
      // console.log(`Adding web tab ${i} at position:`, position);
      this.calculations.webHoles.push({ position: roundHalf(position), active: true, type: 'WEB TAB' });
    }
  }

  private generateHolesInRange(
    startPos: number, 
    endPos: number, 
    spacing: number, 
    maxHoles: number, 
    holeType: string, 
    targetArray: Array<{ position: number; active: boolean; type: string }>
  ) {
    // Calculate total span for holes
    const totalSpan = (maxHoles - 1) * spacing;
    const centerStart = startPos + (endPos - startPos - totalSpan) / 2;
    
    // Generate holes symmetrically
    for (let i = 0; i < maxHoles; i++) {
      const position = centerStart + (i * spacing);
      targetArray.push({ position: roundHalf(position), active: true, type: holeType });
    }
  }

  private generateWebTabsWithClearance(
    startPos: number,
    endPos: number,
    spacing: number,
    maxHoles: number,
    servicePositions: number[],
    minClearance: number
  ) {
    const webTabPositions: number[] = [];
    
    // Try to place web tabs with clearance from service holes
    for (let i = 0; i < maxHoles; i++) {
      const idealPos = startPos + (i * spacing) + (endPos - startPos - (maxHoles - 1) * spacing) / 2;
      
      // Check if this position conflicts with service holes
      const hasConflict = servicePositions.some(servicePos => 
        Math.abs(idealPos - servicePos) < minClearance
      );
      
      if (!hasConflict) {
        webTabPositions.push(roundHalf(idealPos));
      } else {
        // Try to find alternative position
        let alternativePos = idealPos;
        let offset = spacing / 4; // Start with quarter spacing offset
        
        while (Math.abs(offset) < spacing / 2) {
          const testPos1 = idealPos + offset;
          const testPos2 = idealPos - offset;
          
          const conflict1 = servicePositions.some(servicePos => 
            Math.abs(testPos1 - servicePos) < minClearance
          );
          const conflict2 = servicePositions.some(servicePos => 
            Math.abs(testPos2 - servicePos) < minClearance
          );
          
          if (!conflict1 && testPos1 >= startPos && testPos1 <= endPos) {
            webTabPositions.push(roundHalf(testPos1));
            break;
          } else if (!conflict2 && testPos2 >= startPos && testPos2 <= endPos) {
            webTabPositions.push(roundHalf(testPos2));
            break;
          }
          
          offset += spacing / 8; // Increase offset incrementally
        }
      }
    }
    
    // Add web tabs to the array
    webTabPositions.forEach(position => {
      this.calculations.webHoles.push({ position, active: true, type: 'WEB TAB' });
    });
  }

  private generateCoordinatedBearerHoles(length: number, joistSpacing: number, holeType: string, punchStations?: PunchStationConfig[]) {
    // Check if punch types are enabled
    const isWebTabEnabled = !punchStations || punchStations.some(ps => ps.station === 'WEB TAB' && ps.enabled);
    const isServiceHoleEnabled = !punchStations || punchStations.some(ps => 
      (ps.station === 'M SERVICE HOLE' || ps.station === 'SMALL SERVICE HOLE' || ps.station === 'LARGE SERVICE HOLE') && ps.enabled
    );
    
    // TODO: Remove // console.log for production
    // // console.log('Bearer generation:', { length, joistSpacing, holeType, isWebTabEnabled, isServiceHoleEnabled });
    
    // Generate service holes first (if enabled and not "No Holes")
    if (holeType !== 'No Holes' && isServiceHoleEnabled) {
      const serviceHoleSpacing = this.calculations.openingCentres; // Service hole spacing
      const availableLength = length - (2 * serviceHoleSpacing);
      
      // Calculate how many service holes we can fit
      const maxServiceHoles = Math.floor(availableLength / serviceHoleSpacing);
      
      if (maxServiceHoles >= 1) {
        // Generate service holes symmetrically
        const totalServiceSpan = (maxServiceHoles - 1) * serviceHoleSpacing;
        const serviceStart = serviceHoleSpacing + (availableLength - totalServiceSpan) / 2;
        const serviceHoleType = this.getServiceHoleType(holeType);
        
        for (let i = 0; i < maxServiceHoles; i++) {
          const position = serviceStart + (i * serviceHoleSpacing);
          this.calculations.serviceHoles.push({ position: roundHalf(position), active: true, type: serviceHoleType });
        }
      }
    }
    
    // Generate web tabs at exact joist spacing intervals (if enabled)
    if (isWebTabEnabled) {
      const startOffset = joistSpacing; // Start at first joist position
      const endOffset = length - joistSpacing; // End at last joist position
      
      // console.log('Generating bearer web tabs:', { startOffset, endOffset, joistSpacing });
      
      // Calculate how many web tabs fit with the given spacing
      const numWebTabs = Math.floor((endOffset - startOffset) / joistSpacing) + 1;
      
      // console.log('Number of web tabs:', numWebTabs);
      
      // Generate web tabs at exact joist spacing intervals
      for (let i = 0; i < numWebTabs; i++) {
        const position = startOffset + (i * joistSpacing);
        if (position <= endOffset) {
          this.calculations.webHoles.push({ position: roundHalf(position), active: true, type: 'WEB TAB' });
          // console.log(`Added bearer web tab at ${roundHalf(position)}`);
        }
      }
    }
  }

  private generateSymmetricalBearerHoles(length: number, spacing: number, holeType: string, targetArray: Array<{ position: number; active: boolean; type: string }>) {
    // Calculate how many holes we can fit with the given spacing
    const maxHoles = Math.floor((length - spacing) / spacing);
    
    // If we can fit at least 2 holes, distribute them symmetrically
    if (maxHoles >= 2) {
      // Calculate the total span for holes
      const totalSpan = (maxHoles - 1) * spacing;
      const startPos = spacing + (length - 2 * spacing - totalSpan) / 2;
      
      // Generate holes symmetrically
      for (let i = 0; i < maxHoles; i++) {
        const position = startPos + (i * spacing);
        targetArray.push({ position: roundHalf(position), active: true, type: holeType });
      }
    } else if (maxHoles === 1) {
      // Single hole in the center
      const centerPos = length / 2;
      targetArray.push({ position: roundHalf(centerPos), active: true, type: holeType });
    }
  }

  private generateScreensBearerHoles(
    length: number,
    joistSpacing: number,
    holeType: string,
    stubPositions?: number[],
    stubsEnabled?: boolean,
    punchStations?: any[],
    joistBox?: boolean,
  ) {
    // Check if punch types are enabled
    const isBoltHoleEnabled = !punchStations || punchStations.some(ps => ps.station === 'BOLT HOLE' && ps.enabled);
    const isWebTabEnabled = !punchStations || punchStations.some(ps => ps.station === 'WEB TAB' && ps.enabled);
    const isDimpleEnabled = !punchStations || punchStations.some(ps => ps.station === 'DIMPLE' && ps.enabled);
    const isServiceHoleEnabled = !punchStations || punchStations.some(ps => 
      (ps.station === 'M SERVICE HOLE' || ps.station === 'SMALL SERVICE HOLE' || ps.station === 'LARGE SERVICE HOLE') && ps.enabled
    );
    const isServiceEnabled = !punchStations || punchStations.some(ps => ps.station === 'SERVICE' && ps.enabled);
    
    // End bolt holes at 30mm from ends (if enabled)
    if (isBoltHoleEnabled) {
      this.calculations.boltHoles.push({ position: 30, active: true, type: 'BOLT HOLE' });
      this.calculations.boltHoles.push({ position: length - 30, active: true, type: 'BOLT HOLE' });
    }

    // Dimples: every 450mm CTS starting from 479.5mm (if enabled)
    if (isDimpleEnabled) {
      for (let pos = 479.5; pos <= length - 270.5; pos += 450) {
        this.calculations.dimples.push({ position: pos, active: true, type: 'DIMPLE' });
      }
    }

    // JOIST BOX MODE: Triple SERVICE punches at joist positions, suppresses web tabs
    if (joistBox && isServiceEnabled) {
      // In screens mode with joistBox, use screens positioning (475mm from ends)
      const firstWebTab = 475;
      const lastWebTab = length - 475;
      const workingLength = lastWebTab - firstWebTab;
      
      // Collect joist positions (similar to screens web tab logic)
      const joistPositions: number[] = [firstWebTab];
      
      if (workingLength > 0) {
        let currentPos = firstWebTab + joistSpacing;
        while (currentPos < lastWebTab) {
          joistPositions.push(currentPos);
          currentPos += joistSpacing;
        }
      }
      
      joistPositions.push(lastWebTab);
      
      // Generate triple SERVICE hits at each joist position
      joistPositions.forEach(pos => {
        this.calculations.stubs.push({ position: roundHalf(pos - 12), active: true, type: 'SERVICE' });
        this.calculations.stubs.push({ position: roundHalf(pos), active: true, type: 'SERVICE' });
        this.calculations.stubs.push({ position: roundHalf(pos + 12), active: true, type: 'SERVICE' });
        
        // Bolt hole at exact joist position (centered, no offset) if enabled
        if (isBoltHoleEnabled && pos > 50 && pos < (length - 50)) {
          this.calculations.boltHoles.push({ 
            position: roundHalf(pos), 
            active: true, 
            type: 'BOLT HOLE' 
          });
        }
      });
      
      // Corner brackets
      this.calculations.stubs.push({ position: 131, active: true, type: 'SERVICE' });
      this.calculations.stubs.push({ position: length - 131, active: true, type: 'SERVICE' });
      
      // Web tabs are suppressed in joistBox mode
    } else {
      // NORMAL SCREENS MODE: Web tabs at specific positions
      if (isWebTabEnabled) {
        // First web tab at 475mm
        const firstWebTab = 475;
        // Last web tab at length - 475mm
        const lastWebTab = length - 475;
        // Working length for intermediate tabs
        const workingLength = lastWebTab - firstWebTab;
        
        // Collect web tab positions
        const webTabPositions: number[] = [firstWebTab];
        
        // Generate intermediate web tabs spaced by joistSpacing
        if (workingLength > 0) {
          let currentPos = firstWebTab + joistSpacing;
          while (currentPos < lastWebTab) {
            webTabPositions.push(currentPos);
            currentPos += joistSpacing;
          }
        }
        
        // Add last web tab
        webTabPositions.push(lastWebTab);
        
        // Create web tabs
        webTabPositions.forEach(pos => {
          this.calculations.webHoles.push({ position: roundHalf(pos), active: true, type: 'WEB TAB' });
        });
        
        // Add bolt holes with alternating ±29.5mm offset for each web tab (if enabled)
        if (isBoltHoleEnabled) {
          webTabPositions.forEach((webPos, index) => {
            // Alternate: even index = -29.5, odd index = +29.5
            const offset = (index % 2 === 0) ? -29.5 : 29.5;
            const boltPosition = webPos + offset;
            
            // Only add if not overlapping with end bolts (> 50mm from ends)
            if (boltPosition > 50 && boltPosition < (length - 50)) {
              this.calculations.boltHoles.push({ 
                position: roundHalf(boltPosition), 
                active: true, 
                type: 'BOLT HOLE' 
              });
            }
          });
        }
      }

      // Stubs: same logic as normal bearer
      if (stubsEnabled && stubPositions && stubPositions.length) {
        stubPositions.forEach((pos) => {
          if (pos > 0 && pos < length - 400) {
            this.calculations.stubs.push({ position: pos, active: true, type: 'SERVICE' });
          }
        });
      }
      if (stubsEnabled) {
        const bracketPositions = [131, length - 131, 331, length - 331];
        bracketPositions.forEach((pos) => {
          if (pos > 0 && pos < length) {
            this.calculations.stubs.push({ position: pos, active: true, type: 'SERVICE' });
          }
        });
      }
    }

    // Service holes: follow normal bearer logic if enabled (not affected by joistBox)
    if (holeType !== 'No Holes' && isServiceHoleEnabled) {
      const serviceHoleSpacing = this.calculations.openingCentres; // 650mm
      const startPos = serviceHoleSpacing;
      const endPos = length - serviceHoleSpacing;
      const availableLength = endPos - startPos;
      
      const maxServiceHoles = Math.floor(availableLength / serviceHoleSpacing);
      if (maxServiceHoles >= 1) {
        const totalServiceSpan = (maxServiceHoles - 1) * serviceHoleSpacing;
        const serviceStart = startPos + (availableLength - totalServiceSpan) / 2;
        const serviceHoleType = this.getServiceHoleType(holeType);
        
        for (let i = 0; i < maxServiceHoles; i++) {
          const position = serviceStart + (i * serviceHoleSpacing);
          this.calculations.serviceHoles.push({ position: roundHalf(position), active: true, type: serviceHoleType });
        }
      }
    }
  }

  private generateScreensJoistHoles(
    length: number,
    joistSpacing: number,
    holeType: string,
    endBox?: boolean,
    punchStations?: any[],
  ) {
    // Check if punch types are enabled
    const isBoltHoleEnabled = !punchStations || punchStations.some(ps => ps.station === 'BOLT HOLE' && ps.enabled);
    const isDimpleEnabled = !punchStations || punchStations.some(ps => ps.station === 'DIMPLE' && ps.enabled);
    const isWebTabEnabled = !punchStations || punchStations.some(ps => ps.station === 'WEB TAB' && ps.enabled);
    const isServiceHoleEnabled = !punchStations || punchStations.some(ps => 
      (ps.station === 'M SERVICE HOLE' || ps.station === 'SMALL SERVICE HOLE' || ps.station === 'LARGE SERVICE HOLE') && ps.enabled
    );
    
    // End bolt holes at 30mm from ends (if enabled)
    if (isBoltHoleEnabled) {
      this.calculations.boltHoles.push({ position: 30, active: true, type: 'BOLT HOLE' });
      this.calculations.boltHoles.push({ position: length - 30, active: true, type: 'BOLT HOLE' });
    }

    // Dimples: 600mm intervals with ±75mm offsets (if enabled)
    if (isDimpleEnabled) {
      // First dimple at 75mm
      this.calculations.dimples.push({ position: 75, active: true, type: 'DIMPLE' });
      
      // Paired dimples at 600mm intervals: -75 and +75 from base positions
      for (let basePos = 600; basePos < length - 75; basePos += 600) {
        // Dimple before base position (-75)
        this.calculations.dimples.push({ position: basePos - 75, active: true, type: 'DIMPLE' });
        // Dimple after base position (+75)
        if (basePos + 75 < length - 75) {
          this.calculations.dimples.push({ position: basePos + 75, active: true, type: 'DIMPLE' });
        }
      }
      
      // End dimple at length - 75
      this.calculations.dimples.push({ position: length - 75, active: true, type: 'DIMPLE' });
    }

    // SCREENS MODE: Web tabs at specific positions
    if (isWebTabEnabled) {
      // First web tab at 425mm
      const firstWebTab = 425;
      // Last web tab at length - 425mm
      const lastWebTab = length - 425;
      // Working length for intermediate tabs (length - 850mm)
      const workingLength = lastWebTab - firstWebTab;
      
      // Collect web tab positions
      const webTabPositions: number[] = [firstWebTab];
      
      // Generate intermediate web tabs, evenly spaced at ≤1200mm intervals
      if (workingLength > 0) {
        // Calculate how many intermediate tabs we need
        const numIntermediateSpaces = Math.ceil(workingLength / 1200);
        const actualSpacing = workingLength / numIntermediateSpaces;
        
        for (let i = 1; i < numIntermediateSpaces; i++) {
          const pos = firstWebTab + (i * actualSpacing);
          webTabPositions.push(pos);
        }
      }
      
      // Add last web tab
      webTabPositions.push(lastWebTab);
      
      // Create web tabs
      webTabPositions.forEach(pos => {
        this.calculations.webHoles.push({ position: roundHalf(pos), active: true, type: 'WEB TAB' });
      });
      
      // Add bolt holes centered at web tab positions (no offset for joists)
      if (isBoltHoleEnabled) {
        webTabPositions.forEach((webPos) => {
          // Only add if not overlapping with end bolts (> 50mm from ends)
          if (webPos > 50 && webPos < (length - 50)) {
            this.calculations.boltHoles.push({ 
              position: roundHalf(webPos), 
              active: true, 
              type: 'BOLT HOLE' 
            });
          }
        });
      }
    }

    // Service holes: distributed evenly between web tabs at 650mm spacing
    if (holeType !== 'No Holes' && isServiceHoleEnabled && isWebTabEnabled) {
      const webTabPositions = this.calculations.webHoles
        .map(w => w.position)
        .sort((a, b) => a - b);
      
      const serviceHoleSpacing = 650;
      const serviceHoleType = this.getServiceHoleType(holeType);
      
      // Generate service holes between each pair of web tabs
      for (let i = 0; i < webTabPositions.length - 1; i++) {
        const startPos = webTabPositions[i];
        const endPos = webTabPositions[i + 1];
        const gapLength = endPos - startPos;
        
        // Calculate how many service holes can fit in this gap
        const maxServiceHoles = Math.floor(gapLength / serviceHoleSpacing);
        
        if (maxServiceHoles >= 1) {
          // Distribute service holes evenly in the gap
          const totalSpan = (maxServiceHoles - 1) * serviceHoleSpacing;
          const offset = (gapLength - totalSpan) / 2;
          
          for (let j = 0; j < maxServiceHoles; j++) {
            const position = startPos + offset + (j * serviceHoleSpacing);
            this.calculations.serviceHoles.push({ 
              position: roundHalf(position), 
              active: true, 
              type: serviceHoleType 
            });
          }
        }
      }
    }

    // Check if CORNER BRACKETS is enabled in punch stations
    const isCornerBracketsEnabled = !punchStations || punchStations.some(ps => ps.station === 'CORNER BRACKETS' && ps.enabled);
    
    // Corner bracket punches at 131mm from each end
    if (isCornerBracketsEnabled) {
      this.calculations.stubs.push({ position: 131, active: true, type: 'CORNER BRACKETS' });
      this.calculations.stubs.push({ position: length - 131, active: true, type: 'CORNER BRACKETS' });
    }
  }

  generateCSV(): string {
    const profileType = this.partCode.startsWith('B') ? 'BEARER' : 'JOIST';
    const componentCode = profileType === 'BEARER' ? 'B1-1' : 'J1-1';

    // Actual length (mm)
    const length = this.calculations.lengthMod + this.calculations.endExclusion || 5200;

    // Gather all active punches
    const punches: Punch[] = [];
    const pushActive = (arr: typeof this.calculations.boltHoles) =>
      arr.filter((h) => h.active).forEach((h) => punches.push({ position: h.position, type: h.type as PunchStationType, active: true }));

    pushActive(this.calculations.boltHoles);
    pushActive(this.calculations.webHoles);
    pushActive(this.calculations.serviceHoles);
    pushActive(this.calculations.dimples);
    pushActive(this.calculations.stubs);

    // Sort by position ascending
    punches.sort((a, b) => a.position - b.position);

    let csvLine = `csvCOMPONENT,${componentCode},${this.partCode},${profileType},NORMAL,${this.quantity},${length},0,0,${length},0,50`;

    punches.forEach((p) => {
      // Map CORNER BRACKETS to SERVICE for NC export
      const exportType = p.type === 'CORNER BRACKETS' ? 'SERVICE' : p.type;
      csvLine += `,${exportType},${roundHalf(p.position)}`;
    });

    return csvLine;
  }

  getCalculations(): NCCalculations {
    return this.calculations;
  }

  getPartCode() {
    return this.partCode;
  }
}