import { MANUFACTURING_CONSTANTS } from '../constants';
import { ManufacturingDimensions, SpanTableRecommendation } from '@/types/manufacturing';

/**
 * Round value to 0.5mm precision for manufacturing
 */
export const roundHalf = (value: number): number => 
  Math.round(value * 2) / 2;

/**
 * Calculate clearance distance for a punch type
 */
export const calculateClearance = (
  punchType: string, 
  dimensions: ManufacturingDimensions
): number => {
  if (dimensions.shape === 'round') {
    return (dimensions.diameter || 0) / 2;
  }
  return dimensions.width / 2;
};

/**
 * Validate if a position is within acceptable bounds
 */
export const validatePosition = (
  position: number, 
  profileLength: number, 
  clearance: number
): boolean => {
  return position >= clearance && position <= (profileLength - clearance);
};

/**
 * Calculate bolt hole offset for bearer pattern
 */
export const calculateBoltOffset = (index: number): number => {
  const pattern = MANUFACTURING_CONSTANTS.BOLT_OFFSET_PATTERN;
  return pattern[index % pattern.length];
};

/**
 * Get span table recommendation based on length and kPa rating
 */
export const getSpanTableRecommendation = (
  length: number, 
  kpaRating: '2.5' | '5.0'
): SpanTableRecommendation => {
  const maxLimit = MANUFACTURING_CONSTANTS.SPAN_LIMITS[kpaRating];
  
  if (kpaRating === '2.5') {
    if (length <= 6800) return { profileType: 'Joist Single', joistSpacing: 600, exceedsLimit: false };
    if (length <= 7600) return { profileType: 'Joist Single', joistSpacing: 500, exceedsLimit: false };
    if (length <= 8600) return { profileType: 'Joist Single', joistSpacing: 400, exceedsLimit: false };
    if (length <= 9550) return { profileType: 'Joist Single', joistSpacing: 300, exceedsLimit: false };
    
    if (length <= 9100) return { profileType: 'Joist Box', joistSpacing: 600, exceedsLimit: false };
    if (length <= 9750) return { profileType: 'Joist Box', joistSpacing: 500, exceedsLimit: false };
    if (length <= 10600) return { profileType: 'Joist Box', joistSpacing: 400, exceedsLimit: false };
    if (length <= 11750) return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: false };
    
    return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: true };
  } else {
    if (length <= 4500) return { profileType: 'Joist Single', joistSpacing: 600, exceedsLimit: false };
    if (length <= 5100) return { profileType: 'Joist Single', joistSpacing: 500, exceedsLimit: false };
    if (length <= 5850) return { profileType: 'Joist Single', joistSpacing: 400, exceedsLimit: false };
    if (length <= 7000) return { profileType: 'Joist Single', joistSpacing: 300, exceedsLimit: false };
    
    if (length <= 7700) return { profileType: 'Joist Box', joistSpacing: 500, exceedsLimit: false };
    if (length <= 8350) return { profileType: 'Joist Box', joistSpacing: 400, exceedsLimit: false };
    if (length <= 9300) return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: false };
    
    return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: true };
  }
};

/**
 * Calculate stub positions based on length and spacing
 */
export const calculateStubPositions = (length: number, spacing: number): number[] => {
  if (length <= 662) return [];

  const firstStub = MANUFACTURING_CONSTANTS.FIRST_STUB_POSITION;
  const lastStub = length - MANUFACTURING_CONSTANTS.FIRST_STUB_POSITION;
  const availableLength = lastStub - firstStub;
  
  if (availableLength <= 0) return [firstStub];
  
  const positions: number[] = [firstStub];
  let currentPosition = firstStub;
  
  while (currentPosition + spacing < lastStub) {
    currentPosition += spacing;
    positions.push(currentPosition);
  }
  
  if (positions[positions.length - 1] !== lastStub) {
    positions.push(lastStub);
  }
  
  return positions;
};

/**
 * Check if profile type is bearer
 */
export const isBearerProfile = (profileType: string): boolean => {
  return profileType === 'Bearer Single' || profileType === 'Bearer Box';
};

/**
 * Check if profile type is joist
 */
export const isJoistProfile = (profileType: string): boolean => {
  return profileType === 'Joist Single' || profileType === 'Joist Box';
};
