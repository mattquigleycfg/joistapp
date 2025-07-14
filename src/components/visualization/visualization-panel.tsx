import { useMemo } from 'react';
import { PlatformData, ProfileData } from '@/types/form-types';
import { NCFileGenerator } from '@/lib/nc-generator';

interface VisualizationPanelProps {
  platformData: PlatformData;
  profileData: ProfileData;
  ncGenerator: NCFileGenerator | null;
}

export function VisualizationPanel({ platformData: _platformData, profileData, ncGenerator }: VisualizationPanelProps) {
  const svgData = useMemo(() => {
    if (!ncGenerator) return null;

    const calculations = ncGenerator.getCalculations();
    
    // SVG dimensions – enlarged for better visibility
    const svgWidth = 1200;
    const svgHeight = 700;
    
    // Use a consistent scale that maintains proper proportions
    // Base scale on the profile length to fit within the available width
    // Allow a larger maximum scale (0.18) for clearer visuals
    const baseScale = Math.min((svgWidth - 150) / profileData.length, 0.18);
    
    // Scaled dimensions - use same scale for both length and height to maintain proportions
    const profileLength = profileData.length * baseScale;
    const profileHeight = profileData.profileHeight * baseScale;
    
    // Center the profile in the SVG
    const offsetX = (svgWidth - profileLength) / 2;
    const offsetY = (svgHeight - profileHeight) / 2 - 20;

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
      <div className="w-full h-[700px] bg-slate-50 rounded-lg border overflow-hidden flex items-center justify-center">
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

  return (
    <div className="w-full h-[700px] bg-slate-50 rounded-lg border overflow-hidden">
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
          {profileData.profileType === 'Joist' && (
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
        
        {/* Dimension lines and text */}
        {/* Length dimension */}
        <line
          x1={offsetX}
          y1={offsetY + profileHeight + (80 * scale) + 30}
          x2={offsetX + profileLength}
          y2={offsetY + profileHeight + (80 * scale) + 30}
          stroke="#374151"
          strokeWidth="1"
          markerEnd="url(#arrowhead)"
          markerStart="url(#arrowhead)"
        />
        <text
          x={offsetX + profileLength / 2}
          y={offsetY + profileHeight + (80 * scale) + 45}
          textAnchor="middle"
          fontSize="14"
          fill="#374151"
          fontFamily="Arial, sans-serif"
          fontWeight="500"
        >
          Length: {profileData.length}mm
        </text>
        
        {/* Height dimension */}
        <line
          x1={offsetX - 40}
          y1={offsetY}
          x2={offsetX - 40}
          y2={offsetY + profileHeight}
          stroke="#374151"
          strokeWidth="1"
          markerEnd="url(#arrowhead)"
          markerStart="url(#arrowhead)"
        />
        <text
          x={offsetX - 50}
          y={offsetY + profileHeight / 2}
          textAnchor="middle"
          fontSize="14"
          fill="#374151"
          fontFamily="Arial, sans-serif"
          fontWeight="500"
          transform={`rotate(-90, ${offsetX - 50}, ${offsetY + profileHeight / 2})`}
        >
          Height: {profileData.profileHeight}mm
        </text>
        
        {/* Profile type and specifications */}
        <text
          x={offsetX}
          y={offsetY - 40}
          fontSize="18"
          fontWeight="bold"
          fill="#1565c0"
          fontFamily="Arial, sans-serif"
        >
          {profileData.profileType} Profile - Front View
        </text>
        
        <text
          x={offsetX}
          y={offsetY - 20}
          fontSize="12"
          fill="#64748b"
          fontFamily="Arial, sans-serif"
        >
          Hole Type: {profileData.holeType} | Spacing: {profileData.holeSpacing}mm
        </text>
        
        {/* Legend with enlarged text and spacing */}
        <g transform={`translate(${offsetX}, ${offsetY + profileHeight + (80 * scale) + 70})`}>
          {/* Bolt holes legend */}
          <circle cx="10" cy="0" r={Math.max(12 * scale / 2, 4)} fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
          <text x="35" y="6" fontSize="14" fill="#374151" fontFamily="Arial, sans-serif">
            Bolt Holes (Ø12mm)
          </text>
          
          {/* Web tabs legend */}
          <rect x="0" y={legendSpacing} width={Math.max(40 * scale, 14)} height={Math.max(20 * scale, 10)} fill="#22c55e" stroke="#16a34a" strokeWidth="1" rx="2" />
          <text x="35" y={legendSpacing + 6} fontSize="14" fill="#374151" fontFamily="Arial, sans-serif">
            Web Tabs
          </text>
          
          {/* Service holes legend */}
          <circle 
            cx="10" 
            cy={legendSpacing * 2} 
            r={Math.min(getHoleDiameter(profileData.holeType) / 2, 15)} 
            fill="#3b82f6" 
            stroke="#2563eb" 
            strokeWidth="1" 
            opacity="0.8"
          />
          <text x="35" y={legendSpacing * 2 + 6} fontSize="14" fill="#374151" fontFamily="Arial, sans-serif">
            Service Holes ({profileData.holeType})
          </text>
          
          {/* Dimples legend (only for joists) */}
          {profileData.profileType === 'Joist' && (() => {
            const dimY = legendSpacing * 3;
            const dimSize = 8;
            return (
              <>
                <polygon
                  points={`2,${dimY - dimSize} ${10 + dimSize},${dimY} 2,${dimY + dimSize} ${10 - dimSize},${dimY}`}
                  fill="#f59e0b"
                  stroke="#d97706"
                  strokeWidth="1"
                />
                <text x="35" y={dimY + 6} fontSize="14" fill="#374151" fontFamily="Arial, sans-serif">
                  Dimples
                </text>
              </>
            );
          })()}
        </g>
        
        {/* Scale indicator */}
        <text
          x={svgWidth - 10}
          y={svgHeight - 10}
          textAnchor="end"
          fontSize="10"
          fill="#94a3b8"
          fontFamily="Arial, sans-serif"
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
  );
}