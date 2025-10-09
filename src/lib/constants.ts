/**
 * Manufacturing Constants and Configuration
 * Centralized constants for NC manufacturing operations
 */

export const MANUFACTURING_CONSTANTS = {
  // Punch dimensions
  BOLT_HOLE_SIZE: 11,
  DIMPLE_SIZE: 5,
  WEB_TAB_WIDTH: 45,
  WEB_TAB_HEIGHT: 70,
  
  // Spacing requirements
  END_EXCLUSION_BASE: 300,
  MIN_CLEARANCE: 50,
  WEB_TAB_CLEARANCE: 22.5,
  SERVICE_CLEARANCE: 250,
  
  // Bearer bolt hole offsets
  BOLT_OFFSET_PATTERN: [-29.5, 29.5],
  
  // Dimple spacing
  DIMPLE_SPACING_BEARER: 450,
  DIMPLE_SPACING_JOIST: 409.5,
  DIMPLE_START_BEARER: 479.5,
  DIMPLE_START_JOIST: 509.5,
  
  // Span table limits
  SPAN_LIMITS: {
    '2.5': 11750,
    '5.0': 9300,
  },
  
  // Service hole spacing
  SERVICE_HOLE_SPACING: 650,
  
  // Tolerance values
  POSITION_TOLERANCE: 10,
  SPACING_TOLERANCE_PERCENT: 0.15,
  MIN_SPACING_TOLERANCE: 100,
  
  // Profile dimensions
  FLANGE_HEIGHT: 63,
  JOIST_FLANGE_HEIGHT: 59,
  PROFILE_THICKNESS: 1.8,
  
  // Default values
  DEFAULT_HOLE_DIAMETER: 200, // Default for joists (bearers typically use 'No Holes')
  DEFAULT_HOLE_EDGE_DISTANCE: 902.3,
  
  // End bolt positions
  END_BOLT_POSITION: 30,
  
  // Stub positions
  CORNER_BRACKET_POSITION: 131,
  FIRST_STUB_POSITION: 331,
  
  // Screens mode positions
  SCREENS_BEARER_FIRST_WEB_TAB: 475,
  SCREENS_JOIST_FIRST_WEB_TAB: 425,
  SCREENS_MAX_WEB_TAB_SPACING: 1200,
} as const;

export type ManufacturingConstants = typeof MANUFACTURING_CONSTANTS;
