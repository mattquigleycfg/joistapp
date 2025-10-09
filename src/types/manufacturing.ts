import { PunchStationType } from './form-types';

export interface PunchStationConfig {
  station: PunchStationType;
  enabled: boolean;
  spacing?: number;
  customPositions?: number[];
}

export interface ManufacturingDimensions {
  width: number;
  height: number;
  diameter?: number;
  shape: 'square' | 'round' | 'rectangular' | 'oval';
}

export interface ClashDetectionConfig {
  minClearance: number;
  tolerance: number;
  severity: 'error' | 'warning';
}

export interface Punch {
  position: number;
  type: PunchStationType;
  active: boolean;
}

export interface SpanTableRecommendation {
  profileType: 'Joist Single' | 'Joist Box';
  joistSpacing: number;
  exceedsLimit: boolean;
}
