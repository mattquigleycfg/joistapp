import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlatformForm } from '@/components/forms/platform-form';
import { ProfileForm } from '@/components/forms/profile-form';
import { ExportForm } from '@/components/forms/export-form';
import { VisualizationPanel } from '@/components/visualization/visualization-panel';
import { NCFileGenerator } from '@/lib/nc-generator';
import { PlatformData, ProfileData, ExportData } from '@/types/form-types';
import { Wrench, Download, Eye, List, Maximize2, FileText, Code } from 'lucide-react';
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
  const [platformData, setPlatformData] = useState<PlatformData>({
    width: 12000,
    span: 6000,
    bays: 3,
    pitch: 2000
  });

  const [profileData, setProfileData] = useState<ProfileData>({
    profileType: 'Bearer Single',
    profileHeight: 350,
    length: 5200,
    joistSpacing: 600,
    stubSpacing: 1200,
    stubsEnabled: true,
    holeType: 'No Holes',
    holeSpacing: 650,
    punchStations: [
      { station: 'BOLT HOLE', enabled: true },
      { station: 'DIMPLE', enabled: true },
      { station: 'WEB TAB', enabled: true },
      { station: 'M SERVICE HOLE', enabled: true },
    ],
    endBoxJoist: false,
  });

  const [exportData, setExportData] = useState<ExportData>({
    quantity: 2,
    programName: 'B_5200_J575_S1200'
  });

  const [ncGenerator, setNcGenerator] = useState<NCFileGenerator | null>(null);

  useEffect(() => {
    const generator = new NCFileGenerator();
    setNcGenerator(generator);
  }, []);

  useEffect(() => {
    if (ncGenerator) {
      ncGenerator.updateCalculations(platformData, profileData, exportData);
    }
  }, [platformData, profileData, exportData, ncGenerator]);

  const handleExportCSV = () => {
    if (!ncGenerator) {
      toast.error('NC Generator not initialized');
      return;
    }

    try {
      const csvContent = ncGenerator.generateCSV();
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
  };

  const tableRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="fade-in-up">
            <h1 className="text-header text-gray-900 text-left">Span+ App</h1>
            <p className="text-subheader text-gray-600 text-left">NC File Generator for Roll Formed Profiles</p>
          </div>
          <div className="flex grid-gap-2">
            <Card className="card-system grid-p-2">
              <div className="text-subheader text-gray-600">Profile Type</div>
              <div className="text-body font-semibold">{profileData.profileType}</div>
            </Card>
            <Card className="card-system grid-p-2">
              <div className="text-subheader text-gray-600">Length</div>
              <div className="text-numbers-bold">{profileData.length}mm</div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Panel - Input Forms */}
          <div className="lg:col-span-1 space-y-6 sidebar-system">
            <Tabs defaultValue="platform" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="platform" className="flex items-center justify-center p-3" title="Platform">
                  <Wrench className="h-5 w-5" />
                </TabsTrigger>
                <TabsTrigger value="profile" className="flex items-center justify-center p-3" title="Profile">
                  <Eye className="h-5 w-5" />
                </TabsTrigger>
                <TabsTrigger value="export" className="flex items-center justify-center p-3" title="Export">
                  <Download className="h-5 w-5" />
                </TabsTrigger>
                <TabsTrigger value="cutting" className="flex items-center justify-center p-3" title="Cutting List">
                  <List className="h-5 w-5" />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="platform">
                <Card>
                  <CardHeader>
                    <CardTitle>Platform Configuration</CardTitle>
                    <CardDescription>
                      Define the overall platform dimensions and layout
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PlatformForm 
                      data={platformData} 
                      onChange={setPlatformData} 
                    />
                  </CardContent>
                </Card>
              </TabsContent>

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
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="text-body font-medium">Interactive Cutting List</p>
                          <p className="text-sm text-gray-600">View punch positions and hole specifications</p>
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
                        <Code className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="text-body font-medium">NC File Data</p>
                          <p className="text-sm text-gray-600">Raw CSV format for machine processing</p>
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
                                <div className="bg-gray-50 p-4 rounded-md">
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
            <Card className="card-system">
              <CardHeader className="grid-p-3">
                <CardTitle className="text-header">Technical Drawing</CardTitle>
                <CardDescription className="text-subheader">
                  Interactive visualization of the {profileData.profileType.toLowerCase().replace(' single', '').replace(' box', '')} profile with dimensions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <VisualizationPanel 
                  platformData={platformData}
                  profileData={profileData}
                  ncGenerator={ncGenerator}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      {/* Hidden cutting-list table for PDF export */}
      {ncGenerator && (
        <div className="absolute left-[-9999px] top-0" ref={tableRef}>
          <VisualizationPanel
            platformData={platformData}
            profileData={profileData}
            ncGenerator={ncGenerator}
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