import { ProfileData } from '@/types/form-types';
import { MANUFACTURING_CONSTANTS } from './constants';

export class ValidationError extends Error {
  constructor(
    message: string, 
    public field: string, 
    public code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateProfileData = (data: ProfileData): void => {
  if (data.length < 1000 || data.length > 15000) {
    throw new ValidationError(
      'Profile length must be between 1000mm and 15000mm',
      'length',
      'INVALID_LENGTH'
    );
  }

  if (data.profileHeight < 200 || data.profileHeight > 500) {
    throw new ValidationError(
      'Profile height must be between 200mm and 500mm',
      'profileHeight',
      'INVALID_HEIGHT'
    );
  }

  if (data.joistSpacing < 400 || data.joistSpacing > 1200) {
    throw new ValidationError(
      'Joist spacing must be between 400mm and 1200mm',
      'joistSpacing',
      'INVALID_JOIST_SPACING'
    );
  }

  // Validate span table limits
  if (data.kpaRating) {
    const maxLimit = MANUFACTURING_CONSTANTS.SPAN_LIMITS[data.kpaRating];
    const spanLength = data.profileType?.includes('Bearer') ? data.joistLength : data.length;
    
    if (spanLength && spanLength > maxLimit) {
      throw new ValidationError(
        `Span length ${spanLength}mm exceeds maximum ${maxLimit}mm for ${data.kpaRating}kPa rating`,
        'spanLength',
        'SPAN_LIMIT_EXCEEDED'
      );
    }
  }
};

export const validatePunchPosition = (
  position: number, 
  profileLength: number, 
  punchType: string
): void => {
  const clearance = getRequiredClearance(punchType);
  
  if (position < clearance) {
    throw new ValidationError(
      `${punchType} position ${position}mm is too close to profile start (minimum ${clearance}mm)`,
      'position',
      'INSUFFICIENT_CLEARANCE_START'
    );
  }
  
  if (position > profileLength - clearance) {
    throw new ValidationError(
      `${punchType} position ${position}mm is too close to profile end (maximum ${profileLength - clearance}mm)`,
      'position',
      'INSUFFICIENT_CLEARANCE_END'
    );
  }
};

const getRequiredClearance = (punchType: string): number => {
  switch (punchType) {
    case 'BOLT HOLE':
      return MANUFACTURING_CONSTANTS.MIN_CLEARANCE;
    case 'WEB TAB':
      return MANUFACTURING_CONSTANTS.WEB_TAB_CLEARANCE;
    case 'SERVICE':
    case 'CORNER BRACKETS':
      return MANUFACTURING_CONSTANTS.SERVICE_CLEARANCE;
    default:
      return MANUFACTURING_CONSTANTS.MIN_CLEARANCE;
  }
};
