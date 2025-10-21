import React from 'react';
import { ProfileData, ExportData } from '@/types/form-types';
import { NCFileGenerator } from '@/lib/nc-generator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PDFExportLayoutProps {
  profileData: ProfileData;
  ncGenerator: NCFileGenerator;
  exportData: ExportData;
  updateVersion: number;
}

// Helper function to render a clean SVG visualization for PDF
const renderVisualizationSVG = (profileData: ProfileData, ncGenerator: NCFileGenerator, updateVersion: number) => {
  const calculations = ncGenerator.getCalculations();
  
  // SVG dimensions
  const svgWidth = 1200;
  const svgHeight = 500;
  
  // Calculate scale
  const maxWidthScale = (svgWidth - 200) / profileData.length;
  const maxHeightScale = (svgHeight - 200) / profileData.profileHeight;
  const baseScale = Math.min(maxWidthScale, maxHeightScale, 0.15);
  
  const profileLength = profileData.length * baseScale;
  const profileHeight = profileData.profileHeight * baseScale;
  
  const offsetX = (svgWidth - profileLength) / 2;
  const offsetY = (svgHeight - profileHeight) / 2;
  
  const flangeHeight = 63 * baseScale;
  const topBoltY = offsetY - flangeHeight / 2;
  const bottomBoltY = offsetY + profileHeight + flangeHeight / 2;
  
  const getHoleDiameter = (holeType: string) => {
    const actualDiameter = holeType.includes('400') ? 400 : // For oval 400x200
                          holeType.includes('200') ? 200 : 
                          holeType.includes('150') ? 150 : 
                          holeType.includes('115') ? 115 : 
                          holeType.includes('110') ? 110 : 50;
    return Math.max(actualDiameter * baseScale, 3);
  };
  
  const isJoist = profileData.profileType === 'Joist Single' || profileData.profileType === 'Joist Box';
  
  return (
    <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
      {/* Background */}
      <rect width={svgWidth} height={svgHeight} fill="#f8fafc" />
      
      {/* Arrow marker definition */}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" fill="#374151" />
        </marker>
      </defs>
      
      {/* Profile outline */}
      <g>
        {/* Main web */}
        <rect x={offsetX} y={offsetY} width={profileLength} height={profileHeight} fill="none" stroke="#1565c0" strokeWidth="2" rx="1" />
        
        {/* Top flange */}
        <rect x={offsetX} y={offsetY - flangeHeight} width={profileLength} height={flangeHeight} fill="none" stroke="#1565c0" strokeWidth="1.5" />
        
        {/* Bottom flange */}
        <rect x={offsetX} y={offsetY + profileHeight} width={profileLength} height={flangeHeight} fill="none" stroke="#1565c0" strokeWidth="1.5" />
        
        {/* Lips for Joist profile */}
        {isJoist && (
          <>
            <rect x={offsetX} y={offsetY - flangeHeight - (15 * baseScale)} width={profileLength} height={15 * baseScale} fill="none" stroke="#1565c0" strokeWidth="1" />
            <rect x={offsetX} y={offsetY + profileHeight + flangeHeight} width={profileLength} height={15 * baseScale} fill="none" stroke="#1565c0" strokeWidth="1" />
          </>
        )}
      </g>
      
      {/* Bolt holes */}
      {calculations.boltHoles?.filter(h => h.active).map((hole, index) => (
        <g key={`bolt-${index}`}>
          <circle cx={offsetX + hole.position * baseScale} cy={topBoltY} r={Math.max(12 * baseScale / 2, 3)} fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
          <circle cx={offsetX + hole.position * baseScale} cy={bottomBoltY} r={Math.max(12 * baseScale / 2, 3)} fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
        </g>
      ))}
      
      {/* Web tabs */}
      {calculations.webHoles?.filter(h => h.active).map((hole, index) => (
        <rect
          key={`web-${index}`}
          x={offsetX + hole.position * baseScale - (20 * baseScale)}
          y={offsetY + profileHeight / 2 - (50 * baseScale)}
          width={40 * baseScale}
          height={100 * baseScale}
          fill="#22c55e"
          stroke="#16a34a"
          strokeWidth="1"
          rx="2"
        />
      ))}
      
      {/* Service holes */}
      {calculations.serviceHoles?.filter(h => h.active).map((hole, index) => {
        const radius = getHoleDiameter(profileData.holeType) / 2;
        return (
          <circle
            key={`service-${index}`}
            cx={offsetX + hole.position * baseScale}
            cy={offsetY + profileHeight / 2}
            r={radius}
            fill="#3b82f6"
            stroke="#2563eb"
            strokeWidth="1"
            opacity="0.8"
          />
        );
      })}
      
      {/* Dimples */}
      {calculations.dimples?.filter(d => d.active).map((dimple, index) => {
        const dimpleSize = 10 * baseScale;
        const centerX = offsetX + dimple.position * baseScale;
        const makePoints = (centerY: number) => `${centerX},${centerY - dimpleSize} ${centerX + dimpleSize},${centerY} ${centerX},${centerY + dimpleSize} ${centerX - dimpleSize},${centerY}`;
        return (
          <g key={`dimple-${index}`}>
            <polygon points={makePoints(topBoltY)} fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
            <polygon points={makePoints(bottomBoltY)} fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
          </g>
        );
      })}
      
      {/* Punch dimensions with smart overlap prevention */}
      <g>
        {/* Web tab dimensions */}
        {calculations.webHoles?.filter(p => p.active).map((punch, index, array) => {
          const positions = array.map(p => offsetX + (p.position * baseScale));
          const x = offsetX + (punch.position * baseScale);
          
          // Calculate Y offset with staggering to prevent overlap
          let yLevel = 0;
          for (let i = 0; i < index; i++) {
            if (Math.abs(positions[i] - x) < 40) yLevel++;
          }
          const dimY = offsetY + profileHeight + flangeHeight + 60 + (yLevel % 3) * 30;
          
          return (
            <g key={`dim-web-${index}`}>
              <line x1={x} y1={offsetY + profileHeight + flangeHeight + 10} x2={x} y2={dimY} stroke="#666" strokeWidth="1" strokeDasharray="3,3" />
              <text x={x} y={dimY + 15} textAnchor="middle" fontSize="10" fill="#262626" fontFamily="Roboto Mono" fontWeight="500">
                {punch.position.toFixed(1)}
              </text>
            </g>
          );
        })}
        
        {/* Service hole dimensions */}
        {calculations.serviceHoles?.filter(p => p.active).map((punch, index, array) => {
          const positions = array.map(p => offsetX + (p.position * baseScale));
          const x = offsetX + (punch.position * baseScale);
          
          let yLevel = 0;
          for (let i = 0; i < index; i++) {
            if (Math.abs(positions[i] - x) < 40) yLevel++;
          }
          const dimY = offsetY - 40 - (yLevel % 3) * 30;
          
          return (
            <g key={`dim-service-${index}`}>
              <line x1={x} y1={offsetY - 10} x2={x} y2={dimY} stroke="#666" strokeWidth="1" strokeDasharray="3,3" />
              <text x={x} y={dimY - 5} textAnchor="middle" fontSize="10" fill="#262626" fontFamily="Roboto Mono" fontWeight="500">
                {punch.position.toFixed(1)}
              </text>
            </g>
          );
        })}
        
        {/* Stub dimensions */}
        {calculations.stubs?.filter(p => p.active).map((punch, index, array) => {
          const positions = array.map(p => offsetX + (p.position * baseScale));
          const x = offsetX + (punch.position * baseScale);
          
          let yLevel = 0;
          for (let i = 0; i < index; i++) {
            if (Math.abs(positions[i] - x) < 40) yLevel++;
          }
          const dimY = offsetY - 70 - (yLevel % 3) * 30;
          
          return (
            <g key={`dim-stub-${index}`}>
              <line x1={x} y1={offsetY - 10} x2={x} y2={dimY} stroke="#666" strokeWidth="1" strokeDasharray="3,3" />
              <text x={x} y={dimY - 5} textAnchor="middle" fontSize="10" fill="#262626" fontFamily="Roboto Mono" fontWeight="500">
                {punch.position.toFixed(1)}
              </text>
            </g>
          );
        })}
        
        {/* Bolt hole dimensions - show for first and last */}
        {calculations.boltHoles?.filter(p => p.active).map((punch, index, array) => {
          // Only show dimensions for first and last bolt holes to avoid clutter
          if (index !== 0 && index !== array.length - 1) return null;
          
          const x = offsetX + (punch.position * baseScale);
          const dimY = offsetY + profileHeight + flangeHeight + 30;
          
          return (
            <g key={`dim-bolt-${index}`}>
              <line x1={x} y1={offsetY + profileHeight + flangeHeight + 10} x2={x} y2={dimY} stroke="#999" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x={x} y={dimY + 12} textAnchor="middle" fontSize="9" fill="#666" fontFamily="Roboto Mono">
                {punch.position.toFixed(1)}
              </text>
            </g>
          );
        })}
      </g>
      
      {/* Profile dimension lines */}
      {/* Length dimension */}
      <line
        x1={offsetX}
        y1={offsetY + profileHeight + flangeHeight + 180}
        x2={offsetX + profileLength}
        y2={offsetY + profileHeight + flangeHeight + 180}
        stroke="#374151"
        strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
        markerStart="url(#arrowhead)"
      />
      <text
        x={offsetX + profileLength / 2}
        y={offsetY + profileHeight + flangeHeight + 200}
        textAnchor="middle"
        fontSize="16"
        fill="#1e293b"
        fontFamily="'Roboto Mono', monospace"
        fontWeight="600"
      >
        Length: {profileData.length}mm
      </text>
      
      {/* Height dimension */}
      <line
        x1={offsetX - 80}
        y1={offsetY}
        x2={offsetX - 80}
        y2={offsetY + profileHeight}
        stroke="#374151"
        strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
        markerStart="url(#arrowhead)"
      />
      <text
        x={offsetX - 110}
        y={offsetY + profileHeight / 2}
        textAnchor="middle"
        fontSize="16"
        fill="#1e293b"
        fontFamily="'Roboto Mono', monospace"
        fontWeight="600"
        transform={`rotate(-90, ${offsetX - 110}, ${offsetY + profileHeight / 2})`}
      >
        Height: {profileData.profileHeight}mm
      </text>
    </svg>
  );
};

export function PDFExportLayout({ profileData, ncGenerator, exportData, updateVersion }: PDFExportLayoutProps) {
  const calculations = ncGenerator.getCalculations();
  
  // Get all punches grouped by type
  const allPunches: Array<{ position: number; type: string; station: string }> = [];
  
  calculations.boltHoles?.filter(h => h.active).forEach(h => {
    allPunches.push({ position: h.position, type: 'BOLT HOLE', station: 'BOLT HOLE' });
  });
  
  calculations.dimples?.filter(h => h.active).forEach(h => {
    allPunches.push({ position: h.position, type: 'DIMPLE', station: 'DIMPLE' });
  });
  
  calculations.webHoles?.filter(h => h.active).forEach(h => {
    allPunches.push({ position: h.position, type: 'WEB TAB', station: 'WEB TAB' });
  });
  
  calculations.serviceHoles?.filter(h => h.active).forEach(h => {
    // Service holes now preserve their actual type (M SERVICE HOLE, SMALL SERVICE HOLE, or LARGE SERVICE HOLE)
    const type = h.type;
    allPunches.push({ position: h.position, type, station: type });
  });
  
  calculations.stubs?.filter(h => h.active).forEach(h => {
    const type = h.type === 'CORNER BRACKETS' ? 'CORNER BRACKETS' : 'SERVICE';
    allPunches.push({ position: h.position, type, station: type });
  });
  
  // Sort by position
  allPunches.sort((a, b) => a.position - b.position);
  
  // Group by station type
  const groupedPunches = allPunches.reduce((acc, punch) => {
    if (!acc[punch.station]) {
      acc[punch.station] = [];
    }
    acc[punch.station].push(punch);
    return acc;
  }, {} as Record<string, typeof allPunches>);
  
  const stationOrder = ['BOLT HOLE', 'DIMPLE', 'WEB TAB', 'M SERVICE HOLE', 'SMALL SERVICE HOLE', 'LARGE SERVICE HOLE', 'SERVICE', 'CORNER BRACKETS'];
  
  // Format current date/time
  const now = new Date();
  const dateTimeString = now.toLocaleString('en-AU', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div className="pdf-export-container">
      {/* Page 1: Landscape - Visualization with Metadata */}
      <div 
        id="page1-visualization" 
        className="bg-white"
        style={{ 
          width: '297mm', 
          height: '210mm',
          padding: '15mm',
          pageBreakAfter: 'always',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Header with metadata */}
        <div style={{ marginBottom: '8mm' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>
            {exportData.programName || 'NC File Export'}
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', color: '#475569' }}>
            <div><strong>Profile Type:</strong> {profileData.profileType}</div>
            <div><strong>Profile Length:</strong> {profileData.length}mm</div>
            {profileData.joistLength && <div><strong>Joist Length:</strong> {profileData.joistLength}mm</div>}
            <div><strong>Profile Height:</strong> {profileData.profileHeight}mm</div>
            <div><strong>Joist Spacing:</strong> {profileData.joistSpacing}mm</div>
            {profileData.kpaRating && <div><strong>kPa Rating:</strong> {profileData.kpaRating}</div>}
            <div><strong>Quantity:</strong> {exportData.quantity}</div>
            <div><strong>Export Date:</strong> {dateTimeString}</div>
            {profileData.joistBox && <div><strong>Joist Box:</strong> Enabled</div>}
          </div>
        </div>
        
        {/* Visualization - Pure SVG rendering */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          {renderVisualizationSVG(profileData, ncGenerator, updateVersion)}
        </div>
        
        {/* Legend */}
        <div style={{ marginTop: '8mm', display: 'flex', gap: '15px', fontSize: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '2px' }}></div>
            <span>Bolt Hole</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></div>
            <span>Dimple</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '2px' }}></div>
            <span>Web Tab</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
            <span>Service Hole</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#9333ea', borderRadius: '2px' }}></div>
            <span>Service/Brackets</span>
          </div>
        </div>
      </div>
      
      {/* Page 2+: Portrait - Punch Station Table */}
      <div 
        id="page2-punch-table" 
        className="bg-white"
        style={{ 
          width: '210mm', 
          minHeight: '297mm',
          padding: '15mm'
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '10mm', color: '#1e293b' }}>
          Punch Station Details
        </h2>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '8px' }}>Station Type</TableHead>
              <TableHead style={{ fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '8px' }}>Position (mm)</TableHead>
              <TableHead style={{ fontWeight: 'bold', backgroundColor: '#f1f5f9', padding: '8px' }}>Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stationOrder.map(stationType => {
              const punches = groupedPunches[stationType];
              if (!punches || punches.length === 0) return null;
              
              return (
                <React.Fragment key={stationType}>
                  {/* Station header row */}
                  <TableRow style={{ backgroundColor: '#f8fafc' }}>
                    <TableCell 
                      colSpan={3} 
                      style={{ 
                        fontWeight: 'bold', 
                        padding: '10px 8px',
                        fontSize: '14px',
                        color: '#0f172a',
                        borderTop: '2px solid #cbd5e1'
                      }}
                    >
                      {stationType} ({punches.length} punches)
                    </TableCell>
                  </TableRow>
                  
                  {/* Punch positions - show all */}
                  {punches.map((punch, index) => (
                    <TableRow key={`${stationType}-${index}`}>
                      <TableCell style={{ padding: '6px 8px', paddingLeft: '20px' }}>
                        {index === 0 ? stationType : ''}
                      </TableCell>
                      <TableCell style={{ padding: '6px 8px', fontFamily: 'monospace' }}>
                        {punch.position.toFixed(1)}
                      </TableCell>
                      <TableCell style={{ padding: '6px 8px' }}>
                        {index + 1} of {punches.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
        
        {/* Summary */}
        <div style={{ marginTop: '15mm', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
          <strong>Total Punches:</strong> {allPunches.length}
          <br />
          <strong>Profile Code:</strong> {ncGenerator.getPartCode()}
        </div>
      </div>
    </div>
  );
}

