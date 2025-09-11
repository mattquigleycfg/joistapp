import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlatformForm } from '@/components/forms/platform-form';
import { ProfileForm } from '@/components/forms/profile-form';
import { ExportForm } from '@/components/forms/export-form';
import { VisualizationPanel } from '@/components/visualization/visualization-panel';
import { NCFileGenerator } from '@/lib/nc-generator';
import { PlatformData, ProfileData, ExportData } from '@/types/form-types';
import { Factory, Wrench, Download, Eye, List } from 'lucide-react';
// Dynamically import heavy libs when needed to avoid initial bundle weight and optimize caching issues
import { toast } from 'sonner';
import { CuttingListTable } from '@/components/cutting-list-table';

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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Factory className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Span+ App</h1>
              <p className="text-gray-600">NC File Generator for Roll Forming Machines</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Card className="px-4 py-2">
              <div className="text-sm text-gray-600">Profile Type</div>
              <div className="font-semibold">{profileData.profileType}</div>
            </Card>
            <Card className="px-4 py-2">
              <div className="text-sm text-gray-600">Length</div>
              <div className="font-semibold">{profileData.length}mm</div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Input Forms */}
          <div className="lg:col-span-1 space-y-6">
            <Tabs defaultValue="platform" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="platform" className="flex items-center space-x-1">
                  <Wrench className="h-4 w-4" />
                  <span>Platform</span>
                </TabsTrigger>
                <TabsTrigger value="profile" className="flex items-center space-x-1">
                  <Eye className="h-4 w-4" />
                  <span>Profile</span>
                </TabsTrigger>
                <TabsTrigger value="export" className="flex items-center space-x-1">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </TabsTrigger>
                <TabsTrigger value="cutting" className="flex items-center space-x-1">
                  <List className="h-4 w-4" />
                  <span>Cutting List</span>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Cutting List Preview</CardTitle>
                    <CardDescription>
                      Review punch details and CSV before exporting
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ncGenerator && (
                      <div className="space-y-4">
                        <div className="w-full overflow-x-auto">
                          <div className="bg-white p-4 rounded-md shadow min-w-fit">
                            <CuttingListTable
                              ncGenerator={ncGenerator}
                              partCode={ncGenerator.getPartCode()}
                              quantity={exportData.quantity}
                              length={profileData.length}
                              holeType={profileData.holeType}
                            />
                          </div>
                        </div>

                        <div>
                          <h3 className="font-semibold mb-2">CSV Preview</h3>
                          <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-48">
                            {ncGenerator.generateCSV()}
                          </pre>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Visualization */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Technical Drawing</CardTitle>
                <CardDescription>
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