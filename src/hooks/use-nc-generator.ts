import { useMemo, useCallback, useRef } from 'react';
import { NCFileGenerator } from '@/lib/nc-generator';
import { ProfileData, ExportData } from '@/types/form-types';

export const useNCGenerator = (profileData: ProfileData, exportData: ExportData) => {
  const generatorRef = useRef<NCFileGenerator | null>(null);
  
  const ncGenerator = useMemo(() => {
    if (!generatorRef.current) {
      generatorRef.current = new NCFileGenerator();
    }
    return generatorRef.current;
  }, []);

  const updateCalculations = useCallback(() => {
    if (ncGenerator) {
      ncGenerator.updateCalculations(null as any, profileData, exportData);
    }
  }, [ncGenerator, profileData, exportData]);

  const generateCSV = useCallback(() => {
    if (!ncGenerator) {
      throw new Error('NC Generator not initialized');
    }
    return ncGenerator.generateCSV();
  }, [ncGenerator]);

  const getCalculations = useCallback(() => {
    if (!ncGenerator) {
      throw new Error('NC Generator not initialized');
    }
    return ncGenerator.getCalculations();
  }, [ncGenerator]);

  const setManualPunches = useCallback((punches: any[] | null) => {
    if (ncGenerator) {
      ncGenerator.setManualPunches(punches, profileData.profileType);
    }
  }, [ncGenerator, profileData.profileType]);

  const clearManualMode = useCallback(() => {
    if (ncGenerator) {
      ncGenerator.clearManualMode();
    }
  }, [ncGenerator]);

  const getUpdateVersion = useCallback(() => {
    if (!ncGenerator) {
      return 0;
    }
    return ncGenerator.getUpdateVersion();
  }, [ncGenerator]);

  return {
    ncGenerator,
    updateCalculations,
    generateCSV,
    getCalculations,
    setManualPunches,
    clearManualMode,
    getUpdateVersion,
  };
};
