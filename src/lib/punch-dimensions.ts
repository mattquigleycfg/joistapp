/**
 * Punch Dimensions and Specifications
 * 
 * Standard punch dimensions for NC manufacturing
 * Each punch type has specific dimensions and manufacturing hit codes
 */

export interface PunchDimension {
  hitCode: string;        // NC hit code (e.g., .1, .2, .3)
  station: string;        // Punch station name
  description: string;    // Full description
  width?: number;         // Width in mm (for rectangular punches)
  height?: number;        // Height in mm (for rectangular punches)
  diameter?: number;      // Diameter in mm (for round punches)
  shape: 'square' | 'round' | 'rectangular' | 'oval';
}

export const PUNCH_DIMENSIONS: Record<string, PunchDimension> = {
  'BOLT HOLE': {
    hitCode: '.1',
    station: 'BOLT HOLE',
    description: '11mm square Bolt Hole',
    width: 11,
    height: 11,
    shape: 'square',
  },
  
  'DIMPLE': {
    hitCode: '.2',
    station: 'DIMPLE',
    description: '5mm round Stitch',
    diameter: 5,
    shape: 'round',
  },
  
  'WEB TAB': {
    hitCode: '.3',
    station: 'WEB TAB',
    description: '70mm (h) x 45mm (w), Web Connection Tab',
    width: 45,
    height: 70,
    shape: 'rectangular',
  },
  
  'SERVICE': {
    hitCode: '.4',
    station: 'SERVICE',
    description: '300mm (h) x 115mm (w) Stub Connection Point',
    width: 115,
    height: 300,
    shape: 'rectangular',
  },
  
  'SMALL SERVICE HOLE': {
    hitCode: '.5',
    station: 'SMALL SERVICE HOLE',
    description: '110mm round Service Hole',
    diameter: 110,
    shape: 'round',
  },
  
  'M SERVICE HOLE': {
    hitCode: '.6',
    station: 'M SERVICE HOLE',
    description: '200mm round Service Hole',
    diameter: 200,
    shape: 'round',
  },
  
  'LARGE SERVICE HOLE': {
    hitCode: '.7',
    station: 'LARGE SERVICE HOLE',
    description: '200mm x 400mm Service Hole',
    width: 200,
    height: 400,
    shape: 'oval',
  },
  
  // Alias for corner brackets (uses SERVICE hit code in export)
  'CORNER BRACKETS': {
    hitCode: '.4',
    station: 'CORNER BRACKETS',
    description: '300mm (h) x 115mm (w) Corner Bracket Point',
    width: 115,
    height: 300,
    shape: 'rectangular',
  },
};

/**
 * Get punch dimensions by station name
 */
export function getPunchDimensions(station: string): PunchDimension | undefined {
  return PUNCH_DIMENSIONS[station];
}

/**
 * Get hit code for a punch station
 */
export function getHitCode(station: string): string {
  const punch = PUNCH_DIMENSIONS[station];
  return punch?.hitCode || '.0';
}

/**
 * Get descriptive text for a punch station
 */
export function getPunchDescription(station: string): string {
  const punch = PUNCH_DIMENSIONS[station];
  return punch?.description || station;
}

/**
 * Get visual dimensions for rendering
 */
export function getVisualDimensions(station: string): { width: number; height: number } {
  const punch = PUNCH_DIMENSIONS[station];
  
  if (!punch) return { width: 10, height: 10 };
  
  if (punch.shape === 'round') {
    return { width: punch.diameter || 10, height: punch.diameter || 10 };
  }
  
  return { width: punch.width || 10, height: punch.height || 10 };
}

/**
 * Punch dimensions reference table (for documentation)
 */
export const PUNCH_DIMENSIONS_TABLE = [
  { hitCode: 'Hit .1', station: 'BOLT HOLE', description: '11mm square Bolt Hole' },
  { hitCode: 'Hit .2', station: 'DIMPLE', description: '5mm round Stitch' },
  { hitCode: 'Hit .3', station: 'WEB TAB', description: '70mm (h) x 45mm (w), Web Connection Tab' },
  { hitCode: 'Hit .4', station: 'SERVICE', description: '300mm (h) x 115mm (w) Stub Connection Point' },
  { hitCode: 'Hit .5', station: 'SMALL SERVICE HOLE', description: '110mm round Service Hole' },
  { hitCode: 'Hit .6', station: 'M SERVICE HOLE', description: '200mm round Service Hole' },
  { hitCode: 'Hit .7', station: 'LARGE SERVICE HOLE', description: '200mm x 400mm Service Hole' },
];

