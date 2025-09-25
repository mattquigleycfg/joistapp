import { useMemo, useState } from 'react';
import { ProfileData } from '@/types/form-types';
import { NCFileGenerator } from '@/lib/nc-generator';
import { PunchEditorTable } from '@/components/punch-editor-table';

interface Punch {
  id: string;
  position: number;
  type: string;
  active: boolean;
}

interface VisualizationPanelProps {
  profileData: ProfileData;
  ncGenerator: NCFileGenerator | null;
  onPunchesUpdate?: (punches: any[] | null) => void;
  onProfileDataUpdate?: (data: Partial<ProfileData>) => void;
}

export function VisualizationPanel({ profileData, ncGenerator, onPunchesUpdate, onProfileDataUpdate }: VisualizationPanelProps) {
  const [manualPunches, setManualPunches] = useState<Punch[] | null>(null);
  
  // Handle punch updates from the editor table
  const handlePunchesUpdate = (punches: Punch[] | null) => {
    setManualPunches(punches);
    
    // Notify parent component to update NC generator and trigger re-renders
    if (onPunchesUpdate) {
      onPunchesUpdate(punches);
    } else if (ncGenerator) {
      // Fallback to direct update if no callback provided (for backward compatibility)
      ncGenerator.setManualPunches(punches);
    }
  };
  
  const svgData = useMemo(() => {
    if (!ncGenerator) return null;

    const calculations = ncGenerator.getCalculations();
    
    // SVG dimensions – reduced height to show table above fold
    const svgWidth = 1200;
    const svgHeight = 400;
    
    // Use a consistent scale that maintains proper proportions
    // Ensure 150px padding from edges
    // Reduced max scale for smaller viewport
    const maxWidthScale = (svgWidth - 300) / profileData.length; // 150px padding on each side
    const maxHeightScale = (svgHeight - 300) / profileData.profileHeight; // 150px padding top/bottom
    const baseScale = Math.min(maxWidthScale, maxHeightScale, 0.12);
    
    // Scaled dimensions - use same scale for both length and height to maintain proportions
    const profileLength = profileData.length * baseScale;
    const profileHeight = profileData.profileHeight * baseScale;
    
    // Center the profile in the SVG with proper padding
    const offsetX = (svgWidth - profileLength) / 2;
    const offsetY = (svgHeight - profileHeight) / 2;

    // Pre-calculate flange and bolt-hole vertical positions
    const flangeHeight = 63 * baseScale;
    const topBoltY = offsetY - flangeHeight / 2;
    const bottomBoltY = offsetY + profileHeight + flangeHeight / 2;

    const legendSpacing = 40; // vertical gap between legend items
    
    return {
      svgWidth,
      svgHeight,
      profileLength,
      profileHeight,
      offsetX,
      offsetY,
      scale: baseScale,
      flangeHeight,
      topBoltY,
      bottomBoltY,
      legendSpacing,
      calculations
    };
  }, [profileData, ncGenerator]);

  if (!svgData) {
    return (
      <div className="w-full h-[400px] bg-slate-50 rounded-lg border overflow-hidden flex items-center justify-center">
        <div className="text-gray-500">Loading visualization...</div>
      </div>
    );
  }

  const { svgWidth, svgHeight, profileLength, profileHeight, offsetX, offsetY, scale, flangeHeight, topBoltY, bottomBoltY, legendSpacing, calculations } = svgData;

  // Get hole diameter in pixels based on actual dimensions and consistent scale
  const getHoleDiameter = (holeType: string) => {
    const actualDiameter = holeType.includes('200') ? 200 : 
                          holeType.includes('150') ? 150 : 
                          holeType.includes('110') ? 110 : 50;
    return Math.max(actualDiameter * scale, 3); // Use same scale as profile, minimum 3px for visibility
  };

  // Component to render stub pattern based on provided SVG
  const StubPattern = ({ centerX, centerY, patternScale }: { centerX: number; centerY: number; patternScale: number }) => {
    // Original SVG viewBox was 290.72 x 472
    // Scale factor to fit the pattern appropriately - increased for more spacing
    const stubRadius = Math.max(4 * patternScale, 2);
    
    // Positions based on original SVG, scaled up for more spacing between holes
    const spacing = 1.3; // Increase spacing between holes
    const positions = [
      // Top group - moved closer to top flange
      { x: 26.66 * spacing, y: 26.66 * spacing },
      { x: 264.06 * spacing, y: 26.66 * spacing },
      { x: 26.66 * spacing, y: 142.51 * spacing },
      { x: 264.06 * spacing, y: 142.51 * spacing },
      // Bottom group - moved closer to bottom flange
      { x: 26.66 * spacing, y: 329.49 * spacing },
      { x: 264.06 * spacing, y: 329.49 * spacing },
      { x: 26.66 * spacing, y: 445.34 * spacing },
      { x: 264.06 * spacing, y: 445.34 * spacing },
    ];

    // Scale the original SVG coordinates to fit our pattern size - increased for more spacing
    const patternWidth = 290.72 * patternScale * spacing;
    const patternHeight = 472 * patternScale * spacing;
    
    return (
      <g>
        {positions.map((pos, index) => {
          const x = centerX - (patternWidth / 2) + (pos.x * patternScale);
          const y = centerY - (patternHeight / 2) + (pos.y * patternScale);
          
          return (
            <circle
              key={`stub-circle-${index}`}
              cx={x}
              cy={y}
              r={stubRadius}
              fill="#9333ea"
              stroke="#7c3aed"
              strokeWidth="1"
              opacity="0.9"
            />
          );
        })}
      </g>
    );
  };

  return (
    <>
      <div className="viz-container w-full h-[400px]">
        <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full"
      >
        {/* Background */}
        <rect width={svgWidth} height={svgHeight} fill="#f8fafc" />
        
        {/* Profile outline - Front view showing the web and flanges */}
        <g>
          {/* Main web (vertical section) */}
          <rect
            x={offsetX}
            y={offsetY}
            width={profileLength}
            height={profileHeight}
            fill="none"
            stroke="#1565c0"
            strokeWidth="2"
            rx="1"
          />
          
          {/* Top flange - scaled proportionally */}
          <rect
            x={offsetX}
            y={offsetY - (63 * scale)}
            width={profileLength}
            height={63 * scale}
            fill="none"
            stroke="#1565c0"
            strokeWidth="1.5"
          />
          
          {/* Bottom flange - scaled proportionally */}
          <rect
            x={offsetX}
            y={offsetY + profileHeight}
            width={profileLength}
            height={63 * scale}
            fill="none"
            stroke="#1565c0"
            strokeWidth="1.5"
          />
          
          {/* Lips for Joist profile - scaled proportionally */}
          {(profileData.profileType === 'Joist Single' || profileData.profileType === 'Joist Box') && (
            <>
              <rect
                x={offsetX}
                y={offsetY - (63 * scale) - (15 * scale)}
                width={profileLength}
                height={15 * scale}
                fill="none"
                stroke="#1565c0"
                strokeWidth="1"
              />
              <rect
                x={offsetX}
                y={offsetY + profileHeight + (63 * scale)}
                width={profileLength}
                height={15 * scale}
                fill="none"
                stroke="#1565c0"
                strokeWidth="1"
              />
            </>
          )}
        </g>
        
        {/* Bolt holes (red circles) - rendered at top & bottom flanges */}
        {calculations.boltHoles
          .filter(hole => hole.active)
          .map((hole, index) => (
            <g key={`bolt-${index}`}>              
              {/* Top flange bolt */}
              <circle
                cx={offsetX + hole.position * scale}
                cy={topBoltY}
                r={Math.max(12 * scale / 2, 3)}
                fill="#ef4444"
                stroke="#dc2626"
                strokeWidth="1"
              />
              {/* Bottom flange bolt */}
              <circle
                cx={offsetX + hole.position * scale}
                cy={bottomBoltY}
                r={Math.max(12 * scale / 2, 3)}
                fill="#ef4444"
                stroke="#dc2626"
                strokeWidth="1"
              />
            </g>
          ))}
        
        {/* Web holes/tabs (green rectangles) - positioned along the length with consistent scale */}
        {calculations.webHoles
          .filter(hole => hole.active)
          .map((hole, index) => (
            <rect
              key={`web-${index}`}
              x={offsetX + hole.position * scale - (20 * scale)}
              y={offsetY + profileHeight / 2 - (50 * scale)}
              width={40 * scale}
              height={100 * scale}
              fill="#22c55e"
              stroke="#16a34a"
              strokeWidth="1"
              rx="2"
            />
          ))}
        
        {/* Service holes (blue circles) - scaled consistently with actual dimensions */}
        {calculations.serviceHoles
          .filter(hole => hole.active)
          .map((hole, index) => {
            const radius = getHoleDiameter(profileData.holeType) / 2;
            return (
              <circle
                key={`service-${index}`}
                cx={offsetX + hole.position * scale}
                cy={offsetY + profileHeight / 2}
                r={radius}
                fill="#3b82f6"
                stroke="#2563eb"
                strokeWidth="1"
                opacity="0.8"
              />
            );
          })}
        
        {/* Dimples (small diamonds) - render at both top & bottom flanges */}
        {calculations.dimples
          .filter(dimple => dimple.active)
          .map((dimple, index) => {
            const dimpleSize = 10 * scale;
            const centerX = offsetX + dimple.position * scale;
            const makePoints = (centerY: number) => `
              ${centerX},${centerY - dimpleSize}
              ${centerX + dimpleSize},${centerY}
              ${centerX},${centerY + dimpleSize}
              ${centerX - dimpleSize},${centerY}
            `;
            return (
              <g key={`dimple-${index}`}>  
                <polygon
                  points={makePoints(topBoltY)}
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth="1"
                />
                <polygon
                  points={makePoints(bottomBoltY)}
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        
        {/* Stub positions (purple patterns) - positioned closer to flanges */}
        {calculations.stubs
          .filter(stub => stub.active)
          .map((stub, index) => {
            const stubX = offsetX + stub.position * scale;
            // Position the pattern so top holes are closer to top flange, bottom holes closer to bottom flange
            const stubY = offsetY + profileHeight / 2;
            const patternScale = Math.max(scale * 0.25, 0.025); // Slightly increased scale for better visibility
            
            return (
              <StubPattern
                key={`stub-${index}`}
                centerX={stubX}
                centerY={stubY}
                patternScale={patternScale}
              />
            );
          })}
        
        {/* Dimension lines and text */}
        {/* Length dimension */}
        <line
          x1={offsetX}
          y1={offsetY + profileHeight + flangeHeight + 20}
          x2={offsetX + profileLength}
          y2={offsetY + profileHeight + flangeHeight + 20}
          stroke="#374151"
          strokeWidth="1"
          markerEnd="url(#arrowhead)"
          markerStart="url(#arrowhead)"
        />
        <text
          x={offsetX + profileLength / 2}
          y={offsetY + profileHeight + flangeHeight + 35}
          textAnchor="middle"
          fontSize="12"
          fill="#4b5563"
          fontFamily="'Roboto Mono', monospace"
          fontWeight="500"
        >
          Length: {profileData.length}mm
        </text>
        
        {/* Height dimension */}
        <line
          x1={offsetX - 30}
          y1={offsetY}
          x2={offsetX - 30}
          y2={offsetY + profileHeight}
          stroke="#374151"
          strokeWidth="1"
          markerEnd="url(#arrowhead)"
          markerStart="url(#arrowhead)"
        />
        <text
          x={offsetX - 40}
          y={offsetY + profileHeight / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#4b5563"
          fontFamily="'Roboto Mono', monospace"
          fontWeight="500"
          transform={`rotate(-90, ${offsetX - 40}, ${offsetY + profileHeight / 2})`}
        >
          Height: {profileData.profileHeight}mm
        </text>
        
        {/* Profile type and specifications */}
        <text
          x={offsetX}
          y={offsetY - flangeHeight - 25}
          fontSize="14"
          fontWeight="bold"
          fill="#4b5563"
          fontFamily="'Roboto Mono', monospace"
        >
          {profileData.profileType} Profile - Front View
        </text>
        
        <text
          x={offsetX}
          y={offsetY - flangeHeight - 10}
          fontSize="11"
          fill="#4b5563"
          fontFamily="'Roboto Mono', monospace"
        >
          Hole Type: {profileData.holeType} | Spacing: {profileData.holeSpacing}mm
        </text>
        
        
        {/* Scale indicator */}
        <text
          x={svgWidth - 10}
          y={svgHeight - 10}
          textAnchor="end"
          fontSize="10"
          fill="#6b7280"
          fontFamily="'Roboto Mono', monospace"
        >
          Scale: 1:{Math.round(1/scale)}
        </text>
        
        {/* Arrow markers for dimension lines */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#374151"
            />
          </marker>
        </defs>
        </svg>
      </div>
      
      {/* Punch Editor Table */}
      <PunchEditorTable
        key={`${profileData.profileType}-${profileData.length}-${profileData.holeType}`}
        ncGenerator={ncGenerator}
        onPunchesUpdate={handlePunchesUpdate}
        profileLength={profileData.length}
        profileType={profileData.profileType}
        punchStations={profileData.punchStations}
        onPunchStationsUpdate={(stations) => {
          // Update profile data with new station states
          if (onProfileDataUpdate) {
            onProfileDataUpdate({ punchStations: stations });
          }
          // Trigger manual mode when stations are toggled
          if (onPunchesUpdate) {
            // Get current punches and trigger manual mode
            const currentPunches = ncGenerator?.getCalculations();
            if (currentPunches) {
              const allPunches: any[] = [];
              // Collect active punches after station toggle
              [...(currentPunches.boltHoles || []),
               ...(currentPunches.webHoles || []),
               ...(currentPunches.serviceHoles || []),
               ...(currentPunches.dimples || []),
               ...(currentPunches.stubs || [])]
                .forEach(p => {
                  if (p.active && stations.some((s: any) => s.station === p.type && s.enabled)) {
                    allPunches.push(p);
                  }
                });
              onPunchesUpdate(allPunches);
            }
          }
        }}
      />
      
      {/* Legend moved below table */}
      <div className="card-system grid-m-3 grid-p-3">
        <h3 className="text-header mb-4">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Bolt holes legend */}
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border border-red-600"></div>
            <span className="text-body">Bolt Holes (Ø12mm)</span>
          </div>
          
          {/* Web tabs legend */}
          <div className="flex items-center space-x-2">
            <div className="w-4 h-3 bg-green-500 border border-green-600 rounded-sm"></div>
            <span className="text-body">Web Tabs</span>
          </div>
          
          {/* Service holes legend */}
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border border-blue-600 opacity-80"></div>
            <span className="text-body">Service Holes ({profileData.holeType})</span>
          </div>
          
          {/* Service/Corner Brackets legend */}
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 rounded-full bg-purple-500 border border-purple-600"></div>
              <div className="w-2 h-2 rounded-full bg-purple-500 border border-purple-600"></div>
            </div>
            <span className="text-body">
              {profileData.profileType?.includes('Bearer') ? 'Service Stubs & Corner Brackets' : 'Corner Brackets'}
            </span>
          </div>
          
          {/* Dimples legend (only for joists) */}
          {(profileData.profileType === 'Joist Single' || profileData.profileType === 'Joist Box') && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 border border-yellow-600 rotate-45"></div>
              <span className="text-body">Dimples</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}