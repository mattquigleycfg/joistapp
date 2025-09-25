import {
  PlatformData,
  ProfileData,
  ExportData,
  NCCalculations,
  PunchStationType,
} from '@/types/form-types';

// Utility to round values to 0.5 mm precision
const roundHalf = (value: number) => Math.round(value * 2) / 2;

interface Punch {
  position: number;
  type: PunchStationType;
}

export class NCFileGenerator {
  private calculations: NCCalculations;
  private partCode = '';
  private quantity = 1;
  private manualPunches: any[] | null = null;
  private isManualMode = false;
  private updateVersion = 0; // Track updates to force re-renders

  constructor() {
    this.calculations = this.initializeCalculations();
  }
  
  setManualPunches(punches: any[] | null, profileType?: string) {
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
    // Get all web tab positions
    const webTabPositions = this.calculations.webHoles
      .filter(w => w.active)
      .map(w => w.position);
    
    // Calculate actual profile length from stored calculations
    const profileLength = this.calculations.lengthMod + this.calculations.endExclusion;
    
    // Keep track of existing bolt holes at ends (typically 30mm from ends)
    const endBoltHoles = this.calculations.boltHoles.filter(b => 
      b.position <= 50 || b.position >= (profileLength - 50)
    );
    
    // Keep only end bolt holes and bolt holes that correspond to web tabs
    const validBoltHoles = [...endBoltHoles];
    
    // Add bolt holes for each web tab position if not already present
    webTabPositions.forEach(webPos => {
      const existingBolt = this.calculations.boltHoles.find(b => 
        Math.abs(b.position - webPos) < 50 // 50mm tolerance
      );
      
      if (existingBolt) {
        // Keep existing bolt hole at this position
        if (!validBoltHoles.includes(existingBolt)) {
          validBoltHoles.push(existingBolt);
        }
      } else {
        // Add new bolt hole at web tab position
        validBoltHoles.push({
          position: webPos,
          active: true,
          type: 'BOLT HOLE'
        });
      }
    });
    
    // Remove bolt holes that don't correspond to web tabs (except end bolts)
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
      openingCentres: 650,
      holeQty: 0,
      tabOffset: 0,
      flange: 63,
      thickness: 1.8,
      holeDia: 110,
      holeEdgeDistance: 902.3
    };
  }

  updateCalculations(_platformData: PlatformData, profileData: ProfileData, exportData: ExportData) {
    const length = profileData.length;
    const profileType = profileData.profileType;
    const joistSpacing = profileData.joistSpacing;
    const holeType = profileData.holeType;

    // Store quantity for CSV generation
    this.quantity = exportData.quantity || 1;

    // Use program name from export data as part code, or generate a basic one as fallback
    if (exportData.programName) {
      this.partCode = exportData.programName;
    } else {
      // Fallback: Generate a basic part code: e.g., B_J450_12000_A
      const prefix = (profileType === 'Bearer Single' || profileType === 'Bearer Box') ? 'B' : 'J';
      this.partCode = `${prefix}_${profileData.profileHeight}_${length}_A`;
    }

    // Update basic parameters
    this.calculations.thickness = 1.8;
    this.calculations.flange = (profileType === 'Joist Single' || profileType === 'Joist Box') ? 59 : 63;

    // Calculate hole diameter based on type
    this.calculations.holeDia = this.getHoleDiameter(holeType);
    
    // Calculate end exclusion
    this.calculations.endExclusion = ((this.calculations.holeDia / 2) + 300) * 2;
    this.calculations.lengthMod = length - this.calculations.endExclusion;

    // Set hole edge distance and opening centres
    if (profileType === 'Joist Single' || profileType === 'Joist Box') {
      this.calculations.holeEdgeDistance = this.calculations.endExclusion / 2;
      this.calculations.openingCentres = 650;
    } else {
      this.calculations.holeEdgeDistance = 902.3;
      this.calculations.openingCentres = 650;
    }

    // Use user-supplied hole spacing (default to 650 if absent)
    const desiredSpacing = profileData.holeSpacing || 650;

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
    this.calculations.tabOffset = (profileType === 'Joist Single' || profileType === 'Joist Box')
      ? (this.calculations.endExclusion / 2) + (this.calculations.openingCentres * 2) - (this.calculations.openingCentres / 2)
      : joistSpacing;

    // Only generate automatic hole positions if not in manual mode
    if (!this.isManualMode) {
      // Generate hole positions (pass stub positions for bearer)
      this.generateHolePositions(
        profileType,
        length,
        joistSpacing,
        holeType,
        profileData.stubPositions,
        profileData.stubsEnabled,
        profileData.endBoxJoist,
        profileData.punchStations,
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
      case '200 x 400 Oval': return 200;
      case '115 Round':
      case '115mm':
        return 115;
      default: return 110;
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
  ) {
    // Clear existing holes
    this.calculations.boltHoles = [];
    this.calculations.webHoles = [];
    this.calculations.serviceHoles = [];
    this.calculations.dimples = [];
    this.calculations.stubs = [];

    if (profileType === 'Bearer Single' || profileType === 'Bearer Box') {
      this.generateBearerHoles(length, joistSpacing, holeType, stubPositions, stubsEnabled, punchStations);
    } else {
      // For Joist Single and Joist Box, use the same logic but pass endBox for Joist Box
      const useEndBox = profileType === 'Joist Box';
      this.generateJoistHoles(length, holeType, useEndBox, punchStations);
    }
  }

  private generateBearerHoles(
    length: number,
    joistSpacing: number,
    holeType: string,
    stubPositions?: number[],
    stubsEnabled?: boolean,
    punchStations?: any[],
  ) {
    // Check if punch types are enabled
    const isBoltHoleEnabled = !punchStations || punchStations.some(ps => ps.station === 'BOLT HOLE' && ps.enabled);
    
    // End bolt holes: always at 30 mm from ends (if enabled)
    if (isBoltHoleEnabled) {
      this.calculations.boltHoles.push({ position: 30, active: true, type: 'BOLT HOLE' });
      this.calculations.boltHoles.push({ position: length - 30, active: true, type: 'BOLT HOLE' });
    }

    // Check if dimples are enabled
    const isDimpleEnabled = !punchStations || punchStations.some(ps => ps.station === 'DIMPLE' && ps.enabled);
    
    // Dimples: every 450 mm CTS starting from 479.5 mm (if enabled)
    if (isDimpleEnabled) {
      for (let pos = 479.5; pos <= length - 270.5; pos += 450) {
        this.calculations.dimples.push({ position: pos, active: true, type: 'DIMPLE' });
      }
    }

    // Generate coordinated holes to prevent clashes
    this.generateCoordinatedBearerHoles(length, joistSpacing, holeType, punchStations);
    
    // After web tabs are generated, add corresponding bolt holes (if bolt holes are enabled)
    // Bolt holes should align with web tab positions (where joists connect)
    if (isBoltHoleEnabled) {
      this.calculations.webHoles.forEach(webTab => {
        // Check if a bolt hole already exists near this position (within 50mm tolerance)
        const existingBolt = this.calculations.boltHoles.some(bolt => 
          Math.abs(bolt.position - webTab.position) < 50
        );
        
        if (!existingBolt && webTab.active) {
          this.calculations.boltHoles.push({ 
            position: webTab.position, 
            active: true, 
            type: 'BOLT HOLE' 
          });
        }
      });
    }

    // Check if SERVICE is enabled in punch stations  
    const isServiceEnabled = !punchStations || punchStations.some(ps => ps.station === 'SERVICE' && ps.enabled);
    
    if (isServiceEnabled && stubsEnabled) {
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

  private generateJoistHoles(length: number, holeType: string, endBox?: boolean, punchStations?: any[]) {
    // Check if punch types are enabled
    const isBoltHoleEnabled = !punchStations || punchStations.some(ps => ps.station === 'BOLT HOLE' && ps.enabled);
    const isDimpleEnabled = !punchStations || punchStations.some(ps => ps.station === 'DIMPLE' && ps.enabled);
    
    // Joist bolt holes at 30 mm from ends (if enabled)
    if (isBoltHoleEnabled) {
      this.calculations.boltHoles.push({ position: 30, active: true, type: 'BOLT HOLE' });
      this.calculations.boltHoles.push({ position: length - 30, active: true, type: 'BOLT HOLE' });
    }

    // Dimples: every 409.5 mm CTS starting from 509.5 mm (if enabled)
    if (isDimpleEnabled) {
      for (let pos = 509.5; pos <= length - 100; pos += 409.5) {
        this.calculations.dimples.push({ position: pos, active: true, type: 'DIMPLE' });
      }
    }

    // Generate coordinated holes to prevent clashes
    this.generateCoordinatedJoistHoles(length, holeType, punchStations);

    // Check if SERVICE is enabled (for joists, this means corner brackets)
    const isServiceEnabled = !punchStations || punchStations.some(ps => ps.station === 'SERVICE' && ps.enabled);
    
    // End/Box Joist corner bracket punches
    if (endBox && isServiceEnabled) {
      this.calculations.stubs.push({ position: 131, active: true, type: 'SERVICE' });
      this.calculations.stubs.push({ position: length - 131, active: true, type: 'SERVICE' });
    }
  }

  private generateCoordinatedJoistHoles(length: number, holeType: string, punchStations?: any[]) {
    // Check if punch types are enabled
    const isWebTabEnabled = !punchStations || punchStations.some(ps => ps.station === 'WEB TAB' && ps.enabled);
    const isServiceHoleEnabled = !punchStations || punchStations.some(ps => 
      (ps.station === 'M SERVICE HOLE' || ps.station === 'SMALL SERVICE HOLE') && ps.enabled
    );
    
    // If web tabs are disabled, don't generate them
    if (!isWebTabEnabled) return;
    
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
        punchStations
      );
    } else if (isWebTabEnabled) {
      // No service holes, generate web tabs with minimum spacing (if enabled)
      this.generateWebTabsOnly(
        startOffset,
        startOffset + availableLength,
        minWebTabSpacing
      );
    }
    
  }

  private generateServiceHolesWithWebTabs(
    startPos: number,
    endPos: number,
    serviceHoleSpacing: number,
    minWebTabSpacing: number,
    maxWebTabSpacing: number,
    punchStations?: any[]
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
    for (let i = 0; i < maxServiceHoles; i++) {
      const position = serviceStart + (i * serviceHoleSpacing);
      servicePositions.push(roundHalf(position));
      this.calculations.serviceHoles.push({ position: roundHalf(position), active: true, type: 'M SERVICE HOLE' });
    }
    
    // Generate web tabs between service holes with minimum spacing (if enabled)
    if (isWebTabEnabled) {
      this.generateWebTabsBetweenServiceHoles(servicePositions, minWebTabSpacing, maxWebTabSpacing);
    }
  }

  private generateWebTabsBetweenServiceHoles(servicePositions: number[], minWebTabSpacing: number, maxWebTabSpacing: number) {
    if (servicePositions.length < 2) {
      // If only one service hole, place web tab at center
      const centerPos = servicePositions[0];
      this.calculations.webHoles.push({ position: roundHalf(centerPos), active: true, type: 'WEB TAB' });
      return;
    }
    
    // Place web tabs between service holes only if gap meets minimum spacing
    for (let i = 0; i < servicePositions.length - 1; i++) {
      const servicePos1 = servicePositions[i];
      const servicePos2 = servicePositions[i + 1];
      const gap = servicePos2 - servicePos1;
      
      // Only place web tab if gap meets minimum spacing requirement
      if (gap >= minWebTabSpacing) {
        const webTabPos = servicePos1 + (gap / 2);
        this.calculations.webHoles.push({ position: roundHalf(webTabPos), active: true, type: 'WEB TAB' });
      }
    }
    
    // Add center web tab if we have enough service holes and spacing allows
    if (servicePositions.length >= 3) {
      const centerIndex = Math.floor(servicePositions.length / 2);
      const centerPos = servicePositions[centerIndex];
      
      // Check if center position has adequate spacing from adjacent service holes
      const leftGap = centerIndex > 0 ? centerPos - servicePositions[centerIndex - 1] : Infinity;
      const rightGap = centerIndex < servicePositions.length - 1 ? servicePositions[centerIndex + 1] - centerPos : Infinity;
      
      if (leftGap >= minWebTabSpacing && rightGap >= minWebTabSpacing) {
        this.calculations.webHoles.push({ position: roundHalf(centerPos), active: true, type: 'WEB TAB' });
      }
    }
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

  private generateWebTabsOnly(startPos: number, endPos: number, maxSpacing: number) {
    const availableLength = endPos - startPos;
    const maxWebTabs = Math.floor(availableLength / maxSpacing);
    
    if (maxWebTabs < 1) return;
    
    // Generate web tabs symmetrically
    const totalSpan = (maxWebTabs - 1) * maxSpacing;
    const centerStart = startPos + (availableLength - totalSpan) / 2;
    
    for (let i = 0; i < maxWebTabs; i++) {
      const position = centerStart + (i * maxSpacing);
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

  private generateCoordinatedBearerHoles(length: number, joistSpacing: number, holeType: string, punchStations?: any[]) {
    // Check if punch types are enabled
    const isWebTabEnabled = !punchStations || punchStations.some(ps => ps.station === 'WEB TAB' && ps.enabled);
    const isServiceHoleEnabled = !punchStations || punchStations.some(ps => 
      (ps.station === 'M SERVICE HOLE' || ps.station === 'SMALL SERVICE HOLE') && ps.enabled
    );
    
    // If web tabs are disabled, don't generate them
    if (!isWebTabEnabled) return;
    
    // Define spacing requirements
    const serviceHoleSpacing = this.calculations.openingCentres; // 650mm
    const webTabSpacing = joistSpacing; // Use joist spacing for web tabs
    const maxWebTabSpacing = 2400; // Maximum 2400mm spacing for web tabs
    
    // Generate service holes first (if enabled and not "No Holes")
    if (holeType !== 'No Holes' && isServiceHoleEnabled) {
      this.generateServiceHolesWithWebTabs(
        serviceHoleSpacing, 
        length - serviceHoleSpacing, 
        serviceHoleSpacing,
        webTabSpacing, // Use joist spacing as minimum
        maxWebTabSpacing,
        punchStations
      );
    } else if (isWebTabEnabled) {
      // No service holes, generate web tabs with joist spacing (if enabled)
      this.generateWebTabsOnly(
        joistSpacing,
        length - joistSpacing,
        webTabSpacing
      );
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

  generateCSV(): string {
    const profileType = this.partCode.startsWith('B') ? 'BEARER' : 'JOIST';
    const componentCode = profileType === 'BEARER' ? 'B1-1' : 'J1-1';

    // Actual length (mm)
    const length = this.calculations.lengthMod + this.calculations.endExclusion || 5200;

    // Gather all active punches
    const punches: Punch[] = [];
    const pushActive = (arr: typeof this.calculations.boltHoles) =>
      arr.filter((h) => h.active).forEach((h) => punches.push({ position: h.position, type: h.type as PunchStationType }));

    pushActive(this.calculations.boltHoles);
    pushActive(this.calculations.webHoles);
    pushActive(this.calculations.serviceHoles);
    pushActive(this.calculations.dimples);
    pushActive(this.calculations.stubs);

    // Sort by position ascending
    punches.sort((a, b) => a.position - b.position);

    let csvLine = `csvCOMPONENT,${componentCode},${this.partCode},${profileType},NORMAL,${this.quantity},${length},0,0,${length},0,50`;

    punches.forEach((p) => {
      csvLine += `,${p.type},${roundHalf(p.position)}`;
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