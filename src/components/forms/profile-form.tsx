import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ProfileData, PunchStationType } from '@/types/form-types';
import { Switch } from '@/components/ui/switch';

const profileSchema = z.object({
  profileType: z.enum(['Joist Single', 'Bearer Single', 'Joist Box', 'Bearer Box']),
  profileHeight: z.number().min(200).max(500),
  length: z.number().min(1000).max(15000),
  joistSpacing: z.number().min(400).max(1200),
  stubSpacing: z.number().min(600).max(2400),
  stubsEnabled: z.boolean(),
  holeType: z.enum(['50mm', '200mm', '200mm x 400mm', '115 Round', 'No Holes']),
  holeSpacing: z.number().min(400).max(1000),
  punchStations: z.array(z.object({
    station: z.custom<PunchStationType>(),
    enabled: z.boolean(),
    spacing: z.number().optional(),
    customPositions: z.array(z.number()).optional(),
  })),
  stubPositions: z.array(z.number()).optional(),
  endBoxJoist: z.boolean().optional(),
});

interface ProfileFormProps {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
}

export function ProfileForm({ data, onChange }: ProfileFormProps) {
  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    values: data
  });

  // Function to calculate stub positions based on spacing and length
  const calculateStubPositions = React.useCallback((length: number, spacing: number): number[] => {
    if (length <= 662) return []; // Not enough length for first and last stubs

    const firstStub = 331;
    const lastStub = length - 331;
    const availableLength = lastStub - firstStub;
    
    if (availableLength <= 0) return [firstStub];
    
    const positions = [firstStub];
    
    // Calculate intermediate positions based on spacing
    let currentPosition = firstStub;
    while (currentPosition + spacing < lastStub) {
      currentPosition += spacing;
      positions.push(currentPosition);
    }
    
    // Add the last stub position if it's not already there (avoid duplicates)
    if (positions[positions.length - 1] !== lastStub) {
      positions.push(lastStub);
    }
    
    return positions;
  }, []);

  // Auto-calculate stub positions when spacing or length changes (for Bearer only)
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Auto-calculate stub positions when stub spacing or length changes
      if ((value.profileType === 'Bearer Single' || value.profileType === 'Bearer Box') && 
          (name === 'stubSpacing' || name === 'length') && 
          value.stubSpacing && value.length) {
        const newPositions = calculateStubPositions(value.length, value.stubSpacing);
        form.setValue('stubPositions', newPositions, { shouldValidate: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, calculateStubPositions]);

  // Initial calculation of stub positions for Bearer
  React.useEffect(() => {
    if ((data.profileType === 'Bearer Single' || data.profileType === 'Bearer Box') && data.stubSpacing && data.length && 
        (!data.stubPositions || data.stubPositions.length === 0)) {
      const initialPositions = calculateStubPositions(data.length, data.stubSpacing);
      form.setValue('stubPositions', initialPositions, { shouldValidate: true });
    }
  }, [data.profileType, data.stubSpacing, data.length, data.stubPositions, form, calculateStubPositions]);

  React.useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.profileType && value.profileHeight && value.length && 
          value.joistSpacing && value.stubSpacing && value.holeType && value.holeSpacing) {
        onChange(value as ProfileData);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <Form {...form}>
      <form className="space-y-6">
        <FormField
          control={form.control}
          name="profileType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profile Type</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  // When switching to Joist Single or Joist Box, default the hole type to 200 mm round
                  if ((value === 'Joist Single' || value === 'Joist Box') && form.getValues('holeType') !== '200mm') {
                    form.setValue('holeType', '200mm');
                  }
                  // When switching to Joist Box, enable endBoxJoist by default
                  if (value === 'Joist Box') {
                    form.setValue('endBoxJoist', true);
                  } else if (value === 'Joist Single') {
                    form.setValue('endBoxJoist', false);
                  }
                  // When switching to Bearer Single or Bearer Box, default the hole type to No Holes and calculate stub positions
                  if (value === 'Bearer Single' || value === 'Bearer Box') {
                    if (form.getValues('holeType') !== 'No Holes') {
                      form.setValue('holeType', 'No Holes');
                    }
                    // Auto-calculate stub positions when switching to Bearer
                    const length = form.getValues('length');
                    const spacing = form.getValues('stubSpacing');
                    if (length && spacing) {
                      const newPositions = calculateStubPositions(length, spacing);
                      form.setValue('stubPositions', newPositions, { shouldValidate: true });
                    }
                  }
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select profile type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Joist Single">Joist Single</SelectItem>
                  <SelectItem value="Bearer Single">Bearer Single</SelectItem>
                  <SelectItem value="Joist Box">Joist Box</SelectItem>
                  <SelectItem value="Bearer Box">Bearer Box</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="profileHeight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profile Height (mm)</FormLabel>
              <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select height" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="200">200mm</SelectItem>
                  <SelectItem value="250">250mm</SelectItem>
                  <SelectItem value="300">300mm</SelectItem>
                  <SelectItem value="350">350mm</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="length"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Length (mm)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  onChange={e => field.onChange(Number(e.target.value))}
                  className="text-right"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <FormField
          control={form.control}
          name="joistSpacing"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Joist Spacing (Web Tabs)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  onChange={e => field.onChange(Number(e.target.value))}
                  className="text-right"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        <FormField
          control={form.control}
          name="stubSpacing"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stub Spacing (mm)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  onChange={e => field.onChange(Number(e.target.value))}
                  className="text-right"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Stub positions (only visible for Bearer) */}
        {(form.watch('profileType') === 'Bearer Single' || form.watch('profileType') === 'Bearer Box') && (
          <FormField
            control={form.control}
            name="stubPositions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stub Positions (mm, comma separated)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Auto-calculated based on spacing - editable"
                    value={field.value?.join(', ') || ''}
                    onChange={(e) => {
                      const nums = e.target.value
                        .split(',')
                        .map((v) => parseFloat(v.trim()))
                        .filter((n) => !isNaN(n));
                      field.onChange(nums);
                    }}
                  />
                </FormControl>
                <div className="text-xs text-gray-500 mt-1">
                  First stub at 331mm, last stub at {(form.watch('length') || 0) - 331}mm
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Separator />

        <FormField
          control={form.control}
          name="holeType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hole Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hole type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="50mm">50mm Round</SelectItem>
                  <SelectItem value="200mm">200mm Round</SelectItem>
                  <SelectItem value="200mm x 400mm">200mm x 400mm Oval</SelectItem>
                  <SelectItem value="115 Round">115mm Round</SelectItem>
                  <SelectItem value="No Holes">No Holes</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="holeSpacing"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hole Spacing (mm)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  onChange={e => field.onChange(Number(e.target.value))}
                  className="text-right"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />


        {/* Punch Station Selection */}
        <div className="space-y-4">
          <FormLabel className="text-base font-medium">Punch Stations</FormLabel>
          
          {/* Stubs On/Off toggle */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1 pr-4">
                <span className="text-sm font-medium">Stubs On/Off</span>
                <p className="text-xs text-muted-foreground">
                  Enable or disable stub positions in visualization and exports
                </p>
              </div>
              <div className="flex-shrink-0">
                <Switch
                  checked={form.watch('stubsEnabled') || false}
                  onCheckedChange={(value) => form.setValue('stubsEnabled', !!value)}
                />
              </div>
            </div>
          </div>

          {/* Individual Punch Station Switches */}
          {(['BOLT HOLE','DIMPLE','WEB TAB','M SERVICE HOLE','SMALL SERVICE HOLE'] as PunchStationType[]).map((station) => {
            const index = form.getValues('punchStations').findIndex(ps => ps.station === station);
            const checked = index !== -1 ? form.getValues('punchStations')[index].enabled : false;
            return (
              <div key={station} className="grid grid-cols-1 gap-3 rounded-lg border p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1 pr-4">
                    <span className="text-sm font-medium">{station}</span>
                    <p className="text-xs text-muted-foreground">
                      {station === 'BOLT HOLE' && 'Flange bolt holes for structural connections'}
                      {station === 'DIMPLE' && 'Flange stitch dimples for reinforcement'}
                      {station === 'WEB TAB' && 'Web connection tabs for joist connections'}
                      {station === 'M SERVICE HOLE' && 'Main service holes for utilities'}
                      {station === 'SMALL SERVICE HOLE' && 'Small service holes for utilities'}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Switch
                      checked={checked}
                      onCheckedChange={(value) => {
                        const current = form.getValues('punchStations');
                        const existingIndex = current.findIndex(ps => ps.station === station);
                        if (existingIndex !== -1) {
                          current[existingIndex].enabled = !!value;
                        } else {
                          current.push({ station, enabled: !!value });
                        }
                        form.setValue('punchStations', current as any);
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </form>
    </Form>
  );
}