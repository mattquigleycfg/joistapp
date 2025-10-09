export interface PlatformData {
  width: number;
  span: number;
  bays: number;
  pitch: number;
}

export interface ProfileData {
  profileType: 'Joist Single' | 'Bearer Single' | 'Joist Box' | 'Bearer Box';
  profileHeight: number;
  length: number; // Profile Length - actual member length
  joistLength?: number; // Joist Length - only for bearers, represents joist span
  joistSpacing: number;
  stubSpacing: number;
  stubPositions?: number[];
  stubsEnabled: boolean;
  holeType: '50mm' | '200mm' | '200mm x 400mm' | '115 Round' | 'No Holes';
  holeSpacing: number;
  /** Selected punch stations and their settings */
  punchStations: PunchStationSettings[];
  // For joist profiles: add SERVICE punches at 131mm from each end
  endBoxJoist?: boolean;
  // Screens mode: special hole positioning for screen applications
  screensEnabled?: boolean;
  // kPa rating: structural load rating (applies to joists only)
  kpaRating?: '2.5' | '5.0';
}

export interface ExportData {
  quantity: number;
  programName: string;
}

export interface NCCalculations {
  // Hole positions and types
  boltHoles: Array<{ position: number; active: boolean; type: string }>;
  webHoles: Array<{ position: number; active: boolean; type: string }>;
  serviceHoles: Array<{ position: number; active: boolean; type: string }>;
  dimples: Array<{ position: number; active: boolean; type: string }>;
  stubs: Array<{ position: number; active: boolean; type: string }>;
  
  // Calculated values
  endExclusion: number;
  lengthMod: number;
  openingCentres: number;
  holeQty: number;
  tabOffset: number;
  
  // Profile specific
  flange: number;
  thickness: number;
  holeDia: number;
  holeEdgeDistance: number;
}

export type PunchStationType = 'BOLT HOLE' | 'DIMPLE' | 'WEB TAB' | 'M SERVICE HOLE' | 'SMALL SERVICE HOLE' | 'SERVICE' | 'CORNER BRACKETS';

export interface PunchStationSettings {
  station: PunchStationType;
  enabled: boolean;
  spacing?: number; // spacing in mm where applicable (e.g. dimples, web tabs)
  customPositions?: number[]; // explicit positions in mm if supplied by user
}