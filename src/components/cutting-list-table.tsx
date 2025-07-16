import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NCFileGenerator } from '@/lib/nc-generator';

const COLOR_MAP: Record<string, string> = {
  'BOLT HOLE': '#ef4444',
  'DIMPLE': '#f59e0b',
  'WEB TAB': '#22c55e',
  'SERVICE HOLE': '#3b82f6',
  'STUB POSITION': '#9333ea',
};

interface CuttingListTableProps {
  ncGenerator: NCFileGenerator | null;
  partCode: string;
  quantity: number;
  length: number;
  holeType?: string;
}

function formatPunchSummary(positions: number[], spacing?: number): { qty: number; summary: string } {
  if (!positions.length) return { qty: 0, summary: '' };
  const qty = positions.length;
  const sorted = positions.slice().sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (spacing) {
    // Format like "26x @ 450MM CTS (479.5MM-11729.5MM)"
    return {
      qty,
      summary: `${qty}x @ ${spacing}MM CTS (${first}MM-${last}MM)`,
    };
  }
  // Format like "2x @ 30MM/11970MM"
  return {
    qty,
    summary: `${qty}x @ ${sorted.map((p) => `${p}MM`).join('/')}`,
  };
}

const roundOne = (value: number) => Math.round(value * 10) / 10;

export const CuttingListTable: React.FC<CuttingListTableProps> = ({
  ncGenerator,
  partCode,
  quantity,
  length,
  holeType,
}) => {
  if (!ncGenerator) return null;

  const calcs = ncGenerator.getCalculations();

  const boltPositions = calcs.boltHoles.filter((h) => h.active).map((h) => roundOne(h.position));
  const dimplePositions = calcs.dimples.filter((d) => d.active).map((d) => roundOne(d.position));
  const webTabPositions = calcs.webHoles.filter((w) => w.active).map((w) => roundOne(w.position));
  const serviceHolePositions = calcs.serviceHoles.filter((s) => s.active).map((s) => roundOne(s.position));
  const stubPositions = calcs.stubs.filter((s) => s.active).map((s) => roundOne(s.position));

  const boltSummary = formatPunchSummary(boltPositions);
  const dimpleSummary = formatPunchSummary(dimplePositions, 450);
  const webTabSummary = formatPunchSummary(webTabPositions, webTabPositions.length > 1 ? webTabPositions[1] - webTabPositions[0] : undefined);
  const serviceSpacing = serviceHolePositions.length > 1 ? Math.round(serviceHolePositions[1] - serviceHolePositions[0]) : undefined;
  const serviceHoleSummary = formatPunchSummary(serviceHolePositions, serviceSpacing);
  const stubSummary = formatPunchSummary(stubPositions);

  const hasServiceHoles = serviceHolePositions.length > 0;
  const hasStubPositions = stubPositions.length > 0;
  
  // Calculate row span based on what types of holes are present
  let rowSpan = 3; // Base: bolt holes, dimples, web tabs
  if (hasServiceHoles) rowSpan++;
  if (hasStubPositions) rowSpan++;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Punch Station</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Specifications</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Length</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: COLOR_MAP['BOLT HOLE'] }}
            />
            BOLT HOLE
          </TableCell>
          <TableCell>Flange Bolt Hole</TableCell>
          <TableCell>{boltSummary.summary}</TableCell>
          <TableCell rowSpan={rowSpan}>{quantity}</TableCell>
          <TableCell rowSpan={rowSpan}>{length}mm</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: COLOR_MAP['DIMPLE'] }}
            />
            DIMPLE
          </TableCell>
          <TableCell>Flange Stitch</TableCell>
          <TableCell>{dimpleSummary.summary}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: COLOR_MAP['WEB TAB'] }}
            />
            WEB TAB
          </TableCell>
          <TableCell>Web Connection Tab</TableCell>
          <TableCell>{webTabSummary.summary}</TableCell>
        </TableRow>
        {hasServiceHoles && (
          <TableRow>
            <TableCell className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLOR_MAP['SERVICE HOLE'] }}
              />
              SERVICE HOLE
            </TableCell>
            <TableCell>Service Hole</TableCell>
            <TableCell>{serviceHoleSummary.summary}</TableCell>
          </TableRow>
        )}
        {hasStubPositions && (
          <TableRow>
            <TableCell className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLOR_MAP['STUB POSITION'] }}
              />
              STUB POSITION
            </TableCell>
            <TableCell>Stub Connection Point</TableCell>
            <TableCell>{stubSummary.summary}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}; 