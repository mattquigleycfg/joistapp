import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileForm } from '@/components/forms/profile-form';
import { ExportForm } from '@/components/forms/export-form';
import { VisualizationPanel } from '@/components/visualization/visualization-panel';
import { useNCGenerator } from '@/hooks/use-nc-generator';
import { ProfileData, ExportData } from '@/types/form-types';
import { Download, Eye, List, Maximize2, FileText, Code } from 'lucide-react';
// Dynamically import heavy libs when needed to avoid initial bundle weight and optimize caching issues
import { toast } from 'sonner';
import { CuttingListTable } from '@/components/cutting-list-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function SpanPlusApp() {
  // Function to generate program name from profile settings
  const generateProgramName = useCallback((profile: ProfileData): string => {
    // Determine profile code
    let profileCode = '';
    switch (profile.profileType) {
      case 'Bearer Single':
        profileCode = 'B';
        break;
      case 'Bearer Box':
        profileCode = 'BB';
        break;
      case 'Joist Single':
        profileCode = 'J';
        break;
      case 'Joist Box':
        profileCode = 'JB';
        break;
      default:
        profileCode = 'B';
    }
    
    // Build program name: ProfileCode_Length_J[JoistSpacing]_S[StubSpacing]
    let programName = `${profileCode}_${profile.length}`;
    
    // Add joist spacing
    if (profile.joistSpacing) {
      programName += `_J${profile.joistSpacing}`;
    }
    
    // Add stub spacing (only for bearers)
    if ((profile.profileType === 'Bearer Single' || profile.profileType === 'Bearer Box') && profile.stubSpacing) {
      programName += `_S${profile.stubSpacing}`;
    }
    
    return programName;
  }, []);

  const [profileData, setProfileData] = useState<ProfileData>({
    profileType: 'Bearer Single',
    profileHeight: 350,
    length: 5200,
    joistLength: 6000, // Default joist length for bearer
    joistSpacing: 600,
    stubSpacing: 1200,
    stubPositions: [331, 1531, 2731, 3931, 4869], // Initial stub positions for 5200mm length
    stubsEnabled: true,
    holeType: 'No Holes',
    holeSpacing: 650,
    punchStations: [
      { station: 'BOLT HOLE', enabled: true },
      { station: 'DIMPLE', enabled: true },
      { station: 'WEB TAB', enabled: true },
      { station: 'M SERVICE HOLE', enabled: true },
      { station: 'SERVICE', enabled: true },
      { station: 'CORNER BRACKETS', enabled: true },
    ],
    endBoxJoist: false,
    screensEnabled: false,
    kpaRating: '2.5',
    joistBox: false,
  });

  const [exportData, setExportData] = useState<ExportData>({
    quantity: 2,
    programName: generateProgramName({
      profileType: 'Bearer Single',
      profileHeight: 350,
      length: 5200,
      joistLength: 6000,
      joistSpacing: 600,
      stubSpacing: 1200,
      stubPositions: [331, 1531, 2731, 3931, 4869],
      stubsEnabled: true,
      holeType: 'No Holes',
      holeSpacing: 650,
      punchStations: [
        { station: 'BOLT HOLE', enabled: true },
        { station: 'DIMPLE', enabled: true },
        { station: 'WEB TAB', enabled: true },
        { station: 'M SERVICE HOLE', enabled: true },
        { station: 'SERVICE', enabled: true },
        { station: 'CORNER BRACKETS', enabled: true },
      ],
      endBoxJoist: false,
      screensEnabled: false,
      kpaRating: '2.5',
      joistBox: false,
    })
  });

  // Use custom hook for NC generator
  const { 
    ncGenerator, 
    updateCalculations, 
    generateCSV, 
    getCalculations, 
    setManualPunches, 
    clearManualMode, 
    getUpdateVersion 
  } = useNCGenerator(profileData, exportData);

  // Update program name when profile settings change
  useEffect(() => {
    const newProgramName = generateProgramName(profileData);
    setExportData(prev => ({
      ...prev,
      programName: newProgramName
    }));
  }, [profileData, generateProgramName]);

  useEffect(() => {
    if (ncGenerator) {
      // Clear manual mode when profile settings change - Profile Settings should override manual edits
      clearManualMode();
      // Update calculations with new profile data
      updateCalculations();
    }
  }, [profileData, exportData, ncGenerator, clearManualMode, updateCalculations]);
  
  // Callback for when manual punches are updated
  const handleManualPunchesUpdate = useCallback((punches: any[] | null) => {
    if (ncGenerator) {
      if (punches === null) {
        // Reset to calculated mode
        clearManualMode();
        // Recalculate with current settings
        updateCalculations();
      } else {
        // Set manual punches, pass profileType for bolt/web tab sync on bearers
        setManualPunches(punches);
      }
    }
  }, [ncGenerator, clearManualMode, updateCalculations, setManualPunches]);

  const handleExportCSV = useCallback(() => {
    if (!ncGenerator) {
      toast.error('NC Generator not initialized');
      return;
    }

    try {
      const csvContent = generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportData.programName || 'nc_file'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('CSV file exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV file');
      console.error('Export error:', error);
    }
  }, [ncGenerator, generateCSV, exportData.programName]);

  const tableRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = useCallback(async () => {
    if (!tableRef.current) {
      toast.error('Cutting list not available');
      return;
    }

    try {
      // Dynamically import libraries to prevent Vite optimize cache errors
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Capture the table as canvas
      const canvas = await html2canvas(tableRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');

      // Create PDF with landscape orientation
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate image dimensions to fit page while keeping aspect ratio
      const imgProps = canvas.width / canvas.height;
      let pdfWidth = pageWidth - 20; // margins
      let pdfHeight = pdfWidth / imgProps;
      if (pdfHeight > pageHeight - 20) {
        pdfHeight = pageHeight - 20;
        pdfWidth = pdfHeight * imgProps;
      }

      pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth, pdfHeight);
      pdf.save(`${exportData.programName || 'cutting_list'}.pdf`);
      toast.success('Cutting list exported as PDF');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  }, [exportData.programName]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="container mx-auto px-6 py-8 max-w-7xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="fade-in-up">
            <h1 className="text-header">Span+ App</h1>
            <p className="text-subheader">NC File Generator for Roll Formed Profiles</p>
          </div>
          <div className="flex grid-gap-2">
            <Card className="card-system grid-p-2">
              <div className="text-subheader">Profile Type</div>
              <div className="text-body font-semibold">{profileData.profileType}</div>
            </Card>
            <Card className="card-system grid-p-2">
              <div className="text-subheader">Length</div>
              <div className="text-numbers-bold">{profileData.length}mm</div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Panel - Input Forms */}
          <div className="lg:col-span-1 space-y-6 sidebar-system">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto bg-gray-100 p-1">
                <TabsTrigger value="profile" className="flex items-center justify-center p-3 bg-white shadow-sm hover:shadow-md transition-shadow data-[state=active]:bg-white data-[state=active]:shadow-md" title="Profile">
                  <Eye className="h-5 w-5" />
                </TabsTrigger>
                <TabsTrigger value="export" className="flex items-center justify-center p-3 bg-white shadow-sm hover:shadow-md transition-shadow data-[state=active]:bg-white data-[state=active]:shadow-md" title="Export">
                  <Download className="h-5 w-5" />
                </TabsTrigger>
                <TabsTrigger value="cutting" className="flex items-center justify-center p-3 bg-white shadow-sm hover:shadow-md transition-shadow data-[state=active]:bg-white data-[state=active]:shadow-md" title="Cutting List">
                  <List className="h-5 w-5" />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>
                      Configure joist or bearer specifications and hole patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProfileForm 
                      data={profileData} 
                      onChange={setProfileData} 
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="export">
                <Card>
                  <CardHeader>
                    <CardTitle>Export Options</CardTitle>
                    <CardDescription>
                      Set quantity and program name for NC file generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ExportForm 
                      data={exportData} 
                      onChange={setExportData}
                      onExportCSV={handleExportCSV}
                      onExportPDF={handleExportPDF}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cutting">
                <div className="space-y-6">
                  {/* Cutting List Preview Card */}
                  <Card className="card-system">
                    <CardHeader className="grid-p-3">
                      <CardTitle className="text-header">Cutting List Preview</CardTitle>
                      <CardDescription className="text-subheader">
                        Review detailed punch positions and specifications
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid-p-3">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8" style={{color: '#5550F2'}} />
                        <div>
                          <p className="text-body font-medium">Interactive Cutting List</p>
                          <p className="text-sm">View punch positions and hole specifications</p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="expand-button" type="button">
                              <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="white" 
                                strokeWidth="2.5"
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{ margin: 'auto' }}
                              >
                                <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" />
                              </svg>
                              <span className="label ml-2">View Full List</span>
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
                            <DialogHeader>
                              <DialogTitle className="text-header">Cutting List Preview</DialogTitle>
                            </DialogHeader>
                            <div className="overflow-auto max-h-[calc(90vh-120px)]">
                              {ncGenerator && (
                                <div className="bg-white p-4 rounded-md">
                                  <CuttingListTable
                                    key={`cutting-list-${getUpdateVersion()}`}
                                    ncGenerator={ncGenerator}
                                    partCode={ncGenerator.getPartCode()}
                                    quantity={exportData.quantity}
                                    length={profileData.length}
                                    holeType={profileData.holeType}
                                  />
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CSV Preview Card */}
                  <Card className="card-system">
                    <CardHeader className="grid-p-3">
                      <CardTitle className="text-header">CSV Export Preview</CardTitle>
                      <CardDescription className="text-subheader">
                        Review raw CSV data before export
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid-p-3">
                      <div className="flex items-center space-x-3">
                        <Code className="h-8 w-8" style={{color: '#04BF9D'}} />
                        <div>
                          <p className="text-body font-medium">NC File Data</p>
                          <p className="text-sm">Raw CSV format for machine processing</p>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="expand-button" type="button">
                              <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="white" 
                                strokeWidth="2.5"
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{ margin: 'auto' }}
                              >
                                <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" />
                              </svg>
                              <span className="label ml-2">View CSV Data</span>
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                            <DialogHeader>
                              <DialogTitle className="text-header">CSV Export Preview</DialogTitle>
                            </DialogHeader>
                            <div className="overflow-auto max-h-[calc(90vh-120px)]">
                              {ncGenerator && (
                                <div className="bg-gray-50 p-4 rounded-md" key={`csv-preview-${getUpdateVersion()}`}>
                                  <pre className="text-numbers text-sm whitespace-pre-wrap">
                                    {ncGenerator.generateCSV()}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Visualization */}
          <div className="lg:col-span-3">
            <VisualizationPanel 
              profileData={profileData}
              ncGenerator={ncGenerator}
              onPunchesUpdate={handleManualPunchesUpdate}
              onProfileDataUpdate={(updates) => {
                setProfileData(prev => ({ ...prev, ...updates }));
              }}
              updateVersion={getUpdateVersion()}
            />
          </div>
        </div>
      {/* Hidden cutting-list table for PDF export */}
      {ncGenerator && (
        <div className="absolute left-[-9999px] top-0" ref={tableRef} key={`pdf-export-${getUpdateVersion()}`}>
          <VisualizationPanel
            profileData={profileData}
            ncGenerator={ncGenerator}
            onPunchesUpdate={handleManualPunchesUpdate}
            onProfileDataUpdate={(updates) => {
              setProfileData(prev => ({ ...prev, ...updates }));
            }}
            updateVersion={getUpdateVersion()}
          />
          <div className="mt-4">
            <CuttingListTable
              ncGenerator={ncGenerator}
              partCode={ncGenerator.getPartCode()}
              quantity={exportData.quantity}
              length={profileData.length}
              holeType={profileData.holeType}
            />
          </div>
        </div>
      )}
    </div>
  </div>
  );
}