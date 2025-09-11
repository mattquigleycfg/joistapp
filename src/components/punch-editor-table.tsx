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
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NCFileGenerator } from '@/lib/nc-generator';

export type PunchType = 'BOLT HOLE' | 'DIMPLE' | 'WEB TAB' | 'M SERVICE HOLE' | 'SMALL SERVICE HOLE' | 'SERVICE';

export interface Punch {
  id: string;
  position: number;
  type: PunchType;
  active: boolean;
}

interface PunchEditorTableProps {
  ncGenerator: NCFileGenerator | null;
  onPunchesUpdate: (punches: Punch[]) => void;
  profileLength: number;
}

// Color mapping for punch types
const punchColors: Record<PunchType, string> = {
  'BOLT HOLE': 'bg-red-500',
  'DIMPLE': 'bg-yellow-500',
  'WEB TAB': 'bg-green-500',
  'M SERVICE HOLE': 'bg-blue-500',
  'SMALL SERVICE HOLE': 'bg-cyan-500',
  'SERVICE': 'bg-purple-500',
};

const punchBadgeColors: Record<PunchType, string> = {
  'BOLT HOLE': 'bg-red-100 text-red-800 border-red-300',
  'DIMPLE': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'WEB TAB': 'bg-green-100 text-green-800 border-green-300',
  'M SERVICE HOLE': 'bg-blue-100 text-blue-800 border-blue-300',
  'SMALL SERVICE HOLE': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'SERVICE': 'bg-purple-100 text-purple-800 border-purple-300',
};

export function PunchEditorTable({ ncGenerator, onPunchesUpdate, profileLength }: PunchEditorTableProps) {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [history, setHistory] = useState<Punch[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedPunches, setSelectedPunches] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  
  // New punch form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPunchType, setNewPunchType] = useState<PunchType>('BOLT HOLE');
  const [newPunchPosition, setNewPunchPosition] = useState('');

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
    collectPunches(calcs.stubs, 'SERVICE');
    
    setPunches(allPunches);
    setHistory([allPunches]);
    setHistoryIndex(0);
    // Reset other state when profile changes
    setSelectedPunches(new Set());
    setEditingId(null);
    setShowAddForm(false);
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
    if (history.length > 0) {
      setPunches(history[0]);
      setHistoryIndex(0);
      onPunchesUpdate(history[0]);
      setSelectedPunches(new Set());
    }
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

  const handleAddPunch = () => {
    const position = parseFloat(newPunchPosition);
    if (!isNaN(position) && position >= 0 && position <= profileLength) {
      const newPunch: Punch = {
        id: `${newPunchType}-${position}-${Date.now()}`,
        position,
        type: newPunchType,
        active: true,
      };
      const newPunches = [...punches, newPunch];
      setPunches(newPunches);
      addToHistory(newPunches);
      onPunchesUpdate(newPunches);
      setNewPunchPosition('');
      setShowAddForm(false);
    }
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

  return (
    <Card className="card-system grid-m-3">
      <CardHeader className="grid-p-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-header">Punch Station Editor</CardTitle>
          <div className="flex items-center space-x-2">
            {/* Figma-style toolbar */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelecting(!isSelecting)}
                className={cn("h-8 w-8 p-0", isSelecting && "bg-white shadow-sm")}
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
                className="h-8 w-8 p-0"
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="h-8 w-8 p-0"
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 w-8 p-0"
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
            
            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Punch
            </Button>
          </div>
        </div>
        
        {/* Add punch form */}
        {showAddForm && (
          <div className="flex items-center space-x-2 mt-3 p-3 bg-gray-50 rounded-lg">
            <Select value={newPunchType} onValueChange={(v) => setNewPunchType(v as PunchType)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOLT HOLE">Bolt Hole</SelectItem>
                <SelectItem value="DIMPLE">Dimple</SelectItem>
                <SelectItem value="WEB TAB">Web Tab</SelectItem>
                <SelectItem value="M SERVICE HOLE">M Service Hole</SelectItem>
                <SelectItem value="SMALL SERVICE HOLE">Small Service Hole</SelectItem>
                <SelectItem value="SERVICE">Service</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Position (mm)"
              value={newPunchPosition}
              onChange={(e) => setNewPunchPosition(e.target.value)}
              className="w-32"
            />
            <Button size="sm" onClick={handleAddPunch} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                {isSelecting && <TableHead className="w-12 text-body"></TableHead>}
                <TableHead className="w-12 text-body"></TableHead>
                <TableHead className="text-body">Position (mm)</TableHead>
                <TableHead className="text-body">Type</TableHead>
                <TableHead className="w-32 text-body">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedPunches).map(([type, typePunches]) => (
                <React.Fragment key={type}>
                  {/* Group header */}
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableCell colSpan={isSelecting ? 5 : 4} className="font-semibold">
                      <div className="flex items-center space-x-2">
                        <div className={cn("w-3 h-3 rounded-full", punchColors[type as PunchType])} />
                        <span>{type}</span>
                        <Badge variant="secondary" className="ml-2">
                          {typePunches.length} punches
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Punch rows */}
                  {typePunches.map((punch) => (
                    <TableRow 
                      key={punch.id}
                      className={cn(
                        "group hover:bg-gray-50",
                        selectedPunches.has(punch.id) && "bg-blue-50"
                      )}
                    >
                      {isSelecting && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedPunches.has(punch.id)}
                            onChange={() => toggleSelection(punch.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className={cn("w-2 h-2 rounded-full", punchColors[punch.type])} />
                      </TableCell>
                      <TableCell>
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
                              className="h-7 w-7 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                              className="h-7 w-7 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(punch.id, punch.position)}
                            className="text-numbers hover:text-blue-600 transition-colors"
                          >
                            {punch.position.toFixed(1)}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", punchBadgeColors[punch.type])}>
                          {punch.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(punch)}
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Duplicate punch"
                          >
                            <Plus className="h-3 w-3 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(punch.id)}
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete punch"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
