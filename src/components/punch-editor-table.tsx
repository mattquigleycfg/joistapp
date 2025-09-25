import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Trash2, 
  Plus, 
  Undo2, 
  Redo2, 
  RotateCcw,
  MousePointer,
  Edit3,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NCFileGenerator } from '@/lib/nc-generator';

export type PunchType = 'BOLT HOLE' | 'DIMPLE' | 'WEB TAB' | 'M SERVICE HOLE' | 'SMALL SERVICE HOLE' | 'SERVICE' | 'CORNER BRACKETS';

export interface Punch {
  id: string;
  position: number;
  type: PunchType;
  active: boolean;
}

interface PunchEditorTableProps {
  ncGenerator: NCFileGenerator | null;
  onPunchesUpdate: (punches: Punch[] | null) => void;
  profileLength: number;
  profileType?: string;
  punchStations?: any[];
  onPunchStationsUpdate?: (stations: any[]) => void;
}

// Color mapping for punch types
const punchColors: Record<PunchType, string> = {
  'BOLT HOLE': 'bg-red-500',
  'DIMPLE': 'bg-yellow-500',
  'WEB TAB': 'bg-green-500',
  'M SERVICE HOLE': 'bg-blue-500',
  'SMALL SERVICE HOLE': 'bg-cyan-500',
  'SERVICE': 'bg-purple-500',
  'CORNER BRACKETS': 'bg-orange-500',
};

const punchBadgeColors: Record<PunchType, string> = {
  'BOLT HOLE': 'bg-red-100 text-red-800 border-red-300',
  'DIMPLE': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'WEB TAB': 'bg-green-100 text-green-800 border-green-300',
  'M SERVICE HOLE': 'bg-blue-100 text-blue-800 border-blue-300',
  'SMALL SERVICE HOLE': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'SERVICE': 'bg-purple-100 text-purple-800 border-purple-300',
  'CORNER BRACKETS': 'bg-orange-100 text-orange-800 border-orange-300',
};

export function PunchEditorTable({ 
  ncGenerator, 
  onPunchesUpdate, 
  profileLength, 
  profileType,
  punchStations,
  onPunchStationsUpdate 
}: PunchEditorTableProps) {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [history, setHistory] = useState<Punch[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedPunches, setSelectedPunches] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  
  // Track which station groups are collapsed
  const [collapsedStations, setCollapsedStations] = useState<Set<PunchType>>(new Set());
  
  // Track station enabled state (synchronized with Profile Settings)
  const [stationEnabled, setStationEnabled] = useState<Record<PunchType, boolean>>({
    'BOLT HOLE': true,
    'DIMPLE': true,
    'WEB TAB': true,
    'M SERVICE HOLE': true,
    'SMALL SERVICE HOLE': true,
    'SERVICE': true,
    'CORNER BRACKETS': true,
  });

  // Sync station enabled state with Profile Settings
  useEffect(() => {
    if (punchStations) {
      const newEnabled: Record<PunchType, boolean> = {
        'BOLT HOLE': true,
        'DIMPLE': true,
        'WEB TAB': true,
        'M SERVICE HOLE': true,
        'SMALL SERVICE HOLE': true,
        'SERVICE': true,
        'CORNER BRACKETS': true,
      };
      
      punchStations.forEach((ps) => {
        if (ps.station && ps.station in newEnabled) {
          newEnabled[ps.station as PunchType] = ps.enabled;
        }
      });
      
      setStationEnabled(newEnabled);
      
      // Collapse stations that are disabled
      const newCollapsed = new Set<PunchType>();
      (Object.keys(newEnabled) as PunchType[]).forEach(station => {
        if (!newEnabled[station]) {
          newCollapsed.add(station);
        }
      });
      setCollapsedStations(newCollapsed);
    }
  }, [punchStations]);

  // Load punches from NC generator
  useEffect(() => {
    if (!ncGenerator) return;
    
    const calcs = ncGenerator.getCalculations();
    const allPunches: Punch[] = [];
    
    // Collect all punches
    const collectPunches = (arr: any[], type: PunchType) => {
      arr.forEach((p) => {
        if (p.active) {
          allPunches.push({
            id: `${type}-${p.position}`,
            position: p.position,
            type: type as PunchType,
            active: true,
          });
        }
      });
    };
    
    collectPunches(calcs.boltHoles, 'BOLT HOLE');
    collectPunches(calcs.dimples, 'DIMPLE');
    collectPunches(calcs.webHoles, 'WEB TAB');
    collectPunches(calcs.serviceHoles, calcs.serviceHoles[0]?.type === 'SMALL SERVICE HOLE' ? 'SMALL SERVICE HOLE' : 'M SERVICE HOLE');
    
    // Separate corner brackets from service stubs
    const cornerBrackets = calcs.stubs.filter(s => s.position === 131 || s.position === (profileLength - 131));
    const serviceStubs = calcs.stubs.filter(s => s.position !== 131 && s.position !== (profileLength - 131));
    
    collectPunches(cornerBrackets, 'CORNER BRACKETS');
    collectPunches(serviceStubs, 'SERVICE');
    
    setPunches(allPunches);
    setHistory([allPunches]);
    setHistoryIndex(0);
    // Reset other state when profile changes
    setSelectedPunches(new Set());
    setEditingId(null);
  }, [ncGenerator, profileLength]);

  // Group punches by type
  const groupedPunches = punches.reduce((acc, punch) => {
    if (!acc[punch.type]) {
      acc[punch.type] = [];
    }
    acc[punch.type].push(punch);
    return acc;
  }, {} as Record<PunchType, Punch[]>);

  // Sort each group by position
  Object.keys(groupedPunches).forEach((type) => {
    groupedPunches[type as PunchType].sort((a, b) => a.position - b.position);
  });

  const addToHistory = (newPunches: Punch[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPunches);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setPunches(history[newIndex]);
      setHistoryIndex(newIndex);
      onPunchesUpdate(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setPunches(history[newIndex]);
      setHistoryIndex(newIndex);
      onPunchesUpdate(history[newIndex]);
    }
  };

  const handleReset = () => {
    // Reset to calculated mode - pass null to clear manual mode
    onPunchesUpdate(null);
    setSelectedPunches(new Set());
    setEditingId(null);
    // The parent will trigger a recalculation and the useEffect will reload the punches
  };

  const handleDelete = (id: string) => {
    const newPunches = punches.filter(p => p.id !== id);
    setPunches(newPunches);
    addToHistory(newPunches);
    onPunchesUpdate(newPunches);
  };

  const handleDuplicate = (punch: Punch) => {
    // Find a position slightly offset from the original
    const offset = 50; // 50mm offset for the duplicate
    let newPosition = punch.position + offset;
    
    // Ensure the new position is within bounds
    if (newPosition > profileLength) {
      newPosition = punch.position - offset;
      if (newPosition < 0) {
        newPosition = punch.position; // Keep same position if no space
      }
    }
    
    const newPunch: Punch = {
      id: `${punch.type}-${newPosition}-${Date.now()}`,
      position: newPosition,
      type: punch.type,
      active: true,
    };
    
    const newPunches = [...punches, newPunch];
    setPunches(newPunches);
    addToHistory(newPunches);
    onPunchesUpdate(newPunches);
  };

  const handleBulkDelete = () => {
    const newPunches = punches.filter(p => !selectedPunches.has(p.id));
    setPunches(newPunches);
    addToHistory(newPunches);
    onPunchesUpdate(newPunches);
    setSelectedPunches(new Set());
  };

  const handleEdit = (id: string, position: number) => {
    setEditingId(id);
    setEditValue(position.toString());
  };

  const handleSaveEdit = (id: string) => {
    const newPosition = parseFloat(editValue);
    if (!isNaN(newPosition) && newPosition >= 0 && newPosition <= profileLength) {
      const newPunches = punches.map(p => 
        p.id === id ? { ...p, position: newPosition } : p
      );
      setPunches(newPunches);
      addToHistory(newPunches);
      onPunchesUpdate(newPunches);
    }
    setEditingId(null);
  };

  const handleToggleStation = (station: PunchType, enabled: boolean) => {
    // Update local state
    setStationEnabled(prev => ({ ...prev, [station]: enabled }));
    
    // Update collapsed state
    if (!enabled) {
      setCollapsedStations(prev => new Set([...prev, station]));
    } else {
      setCollapsedStations(prev => {
        const newSet = new Set(prev);
        newSet.delete(station);
        return newSet;
      });
    }
    
    // Update Profile Settings
    if (onPunchStationsUpdate) {
      const updatedStations = punchStations ? [...punchStations] : [];
      const existingIndex = updatedStations.findIndex(ps => ps.station === station);
      
      if (existingIndex >= 0) {
        updatedStations[existingIndex].enabled = enabled;
      } else {
        updatedStations.push({ station, enabled });
      }
      
      onPunchStationsUpdate(updatedStations);
    }
    
    // If disabling, remove all punches of this type and trigger manual mode
    if (!enabled) {
      const filteredPunches = punches.filter(p => p.type !== station);
      setPunches(filteredPunches);
      addToHistory(filteredPunches);
      onPunchesUpdate(filteredPunches);
    }
  };

  const handleAddStationPunch = (station: PunchType) => {
    // If station is disabled, enable it first
    if (!stationEnabled[station]) {
      handleToggleStation(station, true);
    }
    
    // Expand the section if collapsed
    setCollapsedStations(prev => {
      const newSet = new Set(prev);
      newSet.delete(station);
      return newSet;
    });
    
    // Find a suitable position for the new punch
    const existingPositions = punches
      .filter(p => p.type === station)
      .map(p => p.position)
      .sort((a, b) => a - b);
    
    let newPosition = 100; // Default position
    if (existingPositions.length > 0) {
      // Place after the last punch of this type
      newPosition = existingPositions[existingPositions.length - 1] + 50;
      if (newPosition > profileLength) {
        // If too far, place before the first punch
        newPosition = Math.max(50, existingPositions[0] - 50);
      }
    }
    
    const newPunch: Punch = {
      id: `${station}-${newPosition}-${Date.now()}`,
      position: newPosition,
      type: station,
      active: true,
    };
    
    const newPunches = [...punches, newPunch];
    setPunches(newPunches);
    addToHistory(newPunches);
    onPunchesUpdate(newPunches);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedPunches);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPunches(newSelected);
  };

  const isBearer = profileType === 'Bearer Single' || profileType === 'Bearer Box';

  // Define display order based on requirements
  const stationDisplayOrder: PunchType[] = [
    'WEB TAB',
    'BOLT HOLE',
    'CORNER BRACKETS',
    'SERVICE',
    'M SERVICE HOLE',
    'SMALL SERVICE HOLE',
    'DIMPLE'
  ];

  // Get dynamic display name for stations based on profile type
  const getStationDisplayName = (stationType: PunchType): string => {
    if (stationType === 'WEB TAB') {
      if (isBearer) {
        return 'WEB TAB JOISTS';
      } else {
        return 'WEB TAB LATERAL BRACE';
      }
    } else if (stationType === 'SERVICE') {
      return 'SERVICE STUBS';
    }
    return stationType;
  };

  return (
    <Card className="card-system grid-m-3">
      <CardHeader className="grid-p-3">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-header">Punch Station Editor</CardTitle>
          <div className="flex items-center space-x-2">
            {/* Figma-style toolbar */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelecting(!isSelecting)}
                className={cn("h-8 w-8 p-0 bg-white shadow-sm hover:shadow-md transition-shadow", isSelecting && "bg-blue-50 shadow-md")}
                title="Select tool"
              >
                <MousePointer className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="h-8 w-8 p-0 bg-white shadow-sm hover:shadow-md transition-shadow disabled:bg-gray-100 disabled:shadow-none"
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="h-8 w-8 p-0 bg-white shadow-sm hover:shadow-md transition-shadow disabled:bg-gray-100 disabled:shadow-none"
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 w-8 p-0 bg-white shadow-sm hover:shadow-md transition-shadow"
                title="Reset to calculated"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            
            {selectedPunches.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                Delete {selectedPunches.size} selected
              </Button>
            )}
          </div>
        </div>
        {isBearer && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-md">
            ⚠️ <strong>Bearer Mode:</strong> Bolt holes automatically align with web tabs. When you edit web tabs, corresponding bolt holes will be updated.
          </div>
        )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                {isSelecting && <TableHead className="w-12 text-body text-left"></TableHead>}
                <TableHead className="w-12 text-body text-left"></TableHead>
                <TableHead className="text-body text-left">Position (mm)</TableHead>
                <TableHead className="text-body text-left">Type</TableHead>
                <TableHead className="w-32 text-body text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stationDisplayOrder.map((type) => {
                const typePunches = groupedPunches[type] || [];
                const isCollapsed = collapsedStations.has(type);
                const isEnabled = stationEnabled[type];
                const displayName = getStationDisplayName(type);
                
                return (
                <React.Fragment key={type}>
                  {/* Group header with controls */}
                  <TableRow className={cn(
                    "hover:bg-gray-50",
                    !isEnabled && "bg-gray-50 opacity-60"
                  )}>
                    <TableCell colSpan={isSelecting ? 5 : 4} className="font-semibold py-2 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 bg-white shadow-sm hover:shadow-md transition-shadow"
                              onClick={() => {
                                if (isCollapsed) {
                                  setCollapsedStations(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(type);
                                    return newSet;
                                  });
                                } else {
                                  setCollapsedStations(prev => new Set([...prev, type]));
                                }
                              }}
                            >
                              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          <div className={cn("w-3 h-3 rounded-full", punchColors[type])} />
                          <span className={cn("text-body", !isEnabled && "text-gray-500")}>{displayName}</span>
                          {typePunches.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {typePunches.length}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddStationPunch(type)}
                            className="h-7 px-2 bg-white shadow-sm hover:shadow-md transition-shadow"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToggleStation(type, checked)}
                            className="data-[state=unchecked]:bg-gray-300"
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Punch rows - only show if not collapsed and enabled */}
                  {!isCollapsed && isEnabled && typePunches.map((punch) => (
                    <TableRow 
                      key={punch.id}
                      className={cn(
                        "group hover:bg-gray-50",
                        selectedPunches.has(punch.id) && "bg-blue-50"
                      )}
                    >
                      {isSelecting && (
                        <TableCell className="text-left">
                          <input
                            type="checkbox"
                            checked={selectedPunches.has(punch.id)}
                            onChange={() => toggleSelection(punch.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-left">
                        <div className={cn("w-2 h-2 rounded-full", punchColors[punch.type])} />
                      </TableCell>
                      <TableCell className="text-left">
                        {editingId === punch.id ? (
                          <div className="flex items-center space-x-1">
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-24 h-7 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveEdit(punch.id)}
                              className="h-7 w-7 p-0 bg-white shadow-sm hover:shadow-md transition-shadow"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                              className="h-7 w-7 p-0 bg-white shadow-sm hover:shadow-md transition-shadow"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(punch.id, punch.position)}
                            className="w-24 h-7 text-sm px-3 py-1 bg-white border border-input rounded-md text-numbers hover:text-blue-600 hover:border-blue-500 transition-colors text-left"
                          >
                            {punch.position.toFixed(1)}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        <Badge className={cn("text-xs", punchBadgeColors[punch.type])}>
                          {punch.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(punch)}
                            className="h-7 w-7 p-0 bg-white shadow-sm hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
                            title="Duplicate punch"
                          >
                            <Plus className="h-3 w-3 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(punch.id)}
                            className="h-7 w-7 p-0 bg-white shadow-sm hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
                            title="Delete punch"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
