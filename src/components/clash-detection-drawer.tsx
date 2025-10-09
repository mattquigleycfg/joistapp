import React from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ClashDetectionResult, ClashIssue } from '@/lib/clash-detection';

interface ClashDetectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clashResult: ClashDetectionResult;
}

export function ClashDetectionDrawer({ open, onOpenChange, clashResult }: ClashDetectionDrawerProps) {
  const { issues, errorCount, warningCount } = clashResult;
  const hasIssues = issues.length > 0;

  const getSeverityIcon = (severity: ClashIssue['severity']) => {
    if (severity === 'error') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  };

  const getSeverityBadge = (severity: ClashIssue['severity']) => {
    if (severity === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Warning</Badge>;
  };

  const getTypeLabel = (type: ClashIssue['type']) => {
    switch (type) {
      case 'clearance': return 'Clearance';
      case 'overlap': return 'Overlap';
      case 'span-limit': return 'Span Limit';
      case 'position-conflict': return 'Position';
      case 'alignment': return 'Alignment';
      default: return type;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            {hasIssues ? (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Clash Detection Results
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                No Clashes Detected
              </>
            )}
          </DrawerTitle>
          <DrawerDescription>
            {hasIssues 
              ? 'Manufacturing rule violations and potential conflicts detected'
              : 'All manufacturing rules satisfied - no conflicts found'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 overflow-auto max-h-[60vh]">
          {hasIssues ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg border p-4 bg-slate-50">
                  <div className="text-2xl font-bold">{issues.length}</div>
                  <div className="text-sm text-muted-foreground">Total Issues</div>
                </div>
                <div className="rounded-lg border p-4 bg-red-50">
                  <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                  <div className="text-sm text-red-700">Errors</div>
                </div>
                <div className="rounded-lg border p-4 bg-amber-50">
                  <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
                  <div className="text-sm text-amber-700">Warnings</div>
                </div>
              </div>

              {/* Issues Table */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead className="w-28">Position</TableHead>
                      <TableHead className="w-32">Element 1</TableHead>
                      <TableHead className="w-32">Element 2</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="w-24 text-center">Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((issue, index) => (
                      <TableRow key={index} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{getTypeLabel(issue.type)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {issue.position !== null ? `${issue.position}mm` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm">{issue.element1}</TableCell>
                        <TableCell className="text-sm">{issue.element2}</TableCell>
                        <TableCell className="text-sm">{issue.issue}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getSeverityIcon(issue.severity)}
                            {getSeverityBadge(issue.severity)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Legend */}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
                <div className="font-medium mb-2">Severity Levels:</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span><strong>Error:</strong> Critical issues that will cause manufacturing problems</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span><strong>Warning:</strong> Potential issues that should be reviewed</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
              <p className="text-muted-foreground max-w-md">
                No manufacturing rule violations or conflicts detected. 
                Your configuration meets all spacing, clearance, and alignment requirements.
              </p>
            </div>
          )}
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

