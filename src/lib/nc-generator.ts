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

  constructor() {
    this.calculations = this.initializeCalculations();
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

    // Generate a basic part code: e.g., B_J450_12000_A
    const prefix = profileType === 'Bearer' ? 'B' : 'J';
    this.partCode = `${prefix}_${profileData.profileHeight}_${length}_A`;

    // Update basic parameters
    this.calculations.thickness = 1.8;
    this.calculations.flange = profileType === 'Joist' ? 59 : 63;

    // Calculate hole diameter based on type
    this.calculations.holeDia = this.getHoleDiameter(holeType);
    
    // Calculate end exclusion
    this.calculations.endExclusion = ((this.calculations.holeDia / 2) + 300) * 2;
    this.calculations.lengthMod = length - this.calculations.endExclusion;

    // Set hole edge distance and opening centres
    if (profileType === 'Joist') {
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
    this.calculations.tabOffset = profileType === 'Joist' 
      ? (this.calculations.endExclusion / 2) + (this.calculations.openingCentres * 2) - (this.calculations.openingCentres / 2)
      : joistSpacing;

    // Generate hole positions (pass stub positions for bearer)
    this.generateHolePositions(
      profileType,
      length,
      joistSpacing,
      holeType,
      profileData.stubPositions,
      profileData.endBoxJoist,
    );
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
    endBox?: boolean,
  ) {
    // Clear existing holes
    this.calculations.boltHoles = [];
    this.calculations.webHoles = [];
    this.calculations.serviceHoles = [];
    this.calculations.dimples = [];
    this.calculations.stubs = [];

    if (profileType === 'Bearer') {
      this.generateBearerHoles(length, joistSpacing, holeType, stubPositions);
    } else {
      this.generateJoistHoles(length, holeType, endBox);
    }
  }

  private generateBearerHoles(
    length: number,
    joistSpacing: number,
    holeType: string,
    stubPositions?: number[],
  ) {
    // Bolt holes: always at 30 mm from ends
    this.calculations.boltHoles.push({ position: 30, active: true, type: 'BOLT HOLE' });
    this.calculations.boltHoles.push({ position: length - 30, active: true, type: 'BOLT HOLE' });

    // Dimples: every 450 mm CTS starting from 479.5 mm
    for (let pos = 479.5; pos <= length - 270.5; pos += 450) {
      this.calculations.dimples.push({ position: pos, active: true, type: 'DIMPLE' });
    }

    // Web tabs: at joist spacing intervals
    for (let pos = joistSpacing; pos <= length - joistSpacing; pos += joistSpacing) {
      this.calculations.webHoles.push({ position: pos, active: true, type: 'WEB TAB' });
    }

    // Service holes (optional based on holeType)
    if (holeType !== 'No Holes') {
      // Small service holes every this.calculations.openingCentres starting from holeEdgeDistance
      for (
        let pos = this.calculations.holeEdgeDistance;
        pos <= length - 400;
        pos += this.calculations.openingCentres
      ) {
        this.calculations.serviceHoles.push({
          position: pos,
          active: true,
          type: 'SMALL SERVICE HOLE',
        });
      }
    }

    // Stubs using explicit positions (stub punch coded as SERVICE)
    if (stubPositions && stubPositions.length) {
      stubPositions.forEach((pos) => {
        if (pos > 0 && pos < length - 400) {
          this.calculations.stubs.push({ position: pos, active: true, type: 'SERVICE' });
        }
      });
    }
    // Corner and first/last stub column brackets
    const bracketPositions = [131, length - 131, 331, length - 331];
    bracketPositions.forEach((pos) => {
      if (pos > 0 && pos < length) {
        this.calculations.stubs.push({ position: pos, active: true, type: 'SERVICE' });
      }
    });
  }

  private generateJoistHoles(length: number, holeType: string, endBox?: boolean) {
    // Joist bolt holes at 30 mm from ends
    this.calculations.boltHoles.push({ position: 30, active: true, type: 'BOLT HOLE' });
    this.calculations.boltHoles.push({ position: length - 30, active: true, type: 'BOLT HOLE' });

    // Dimples: every 409.5 mm CTS starting from 509.5 mm
    for (let pos = 509.5; pos <= length - 100; pos += 409.5) {
      this.calculations.dimples.push({ position: pos, active: true, type: 'DIMPLE' });
    }

    // Web tabs: spaced between service holes, starting mid-way between the 2nd & 3rd service holes
    const tabSpacing = this.calculations.openingCentres * 2; // Ideally between 1200-1800 mm

    // Ensure spacing respects 1200–1800 bounds
    const clampedSpacing = Math.max(1200, Math.min(1800, tabSpacing));

    // First tab is 1.5 × openingCentres from the first service hole edge
    let tabPos = this.calculations.holeEdgeDistance + this.calculations.openingCentres * 1.5;

    // Push tabs while keeping clear of the last 400 mm end distance and avoiding service-hole overlap
    while (tabPos <= length - 400) {
      this.calculations.webHoles.push({ position: roundHalf(tabPos), active: true, type: 'WEB TAB' });
      tabPos += clampedSpacing;
    }

    // End/Box Joist bracket SERVICE punches
    if (endBox) {
      this.calculations.stubs.push({ position: 131, active: true, type: 'SERVICE' });
      this.calculations.stubs.push({ position: length - 131, active: true, type: 'SERVICE' });
    }

    // Service holes selection logic
    if (holeType !== 'No Holes') {
      for (
        let pos = this.calculations.holeEdgeDistance;
        pos <= length - 400;
        pos += this.calculations.openingCentres
      ) {
        this.calculations.serviceHoles.push({
          position: pos,
          active: true,
          type: 'M SERVICE HOLE',
        });
      }
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