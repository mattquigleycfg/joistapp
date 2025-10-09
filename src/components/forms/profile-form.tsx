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
import { toast } from 'sonner';

const profileSchema = z.object({
  profileType: z.enum(['Joist Single', 'Bearer Single', 'Joist Box', 'Bearer Box']),
  profileHeight: z.number().min(200).max(500),
  length: z.number().min(1000).max(15000),
  joistLength: z.number().min(1000).max(15000).optional(),
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
  screensEnabled: z.boolean().optional(),
  kpaRating: z.enum(['2.5', '5.0']).optional(),
});

interface ProfileFormProps {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
}

// kPa span table logic
function getSpanTableRecommendation(length: number, kpaRating: '2.5' | '5.0'): { profileType: 'Joist Single' | 'Joist Box', joistSpacing: number, exceedsLimit: boolean } {
  if (kpaRating === '2.5') {
    // 2.5 kPa - Check Single C first
    if (length <= 6800) return { profileType: 'Joist Single', joistSpacing: 600, exceedsLimit: false };
    if (length <= 7600) return { profileType: 'Joist Single', joistSpacing: 500, exceedsLimit: false };
    if (length <= 8600) return { profileType: 'Joist Single', joistSpacing: 400, exceedsLimit: false };
    if (length <= 9550) return { profileType: 'Joist Single', joistSpacing: 300, exceedsLimit: false };
    
    // Beyond Single C limits - use Box Joist
    if (length <= 9100) return { profileType: 'Joist Box', joistSpacing: 600, exceedsLimit: false };
    if (length <= 9750) return { profileType: 'Joist Box', joistSpacing: 500, exceedsLimit: false };
    if (length <= 10600) return { profileType: 'Joist Box', joistSpacing: 400, exceedsLimit: false };
    if (length <= 11750) return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: false };
    
    // Exceeds all limits
    return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: true };
  } else {
    // 5.0 kPa - Check Single C first
    if (length <= 4500) return { profileType: 'Joist Single', joistSpacing: 600, exceedsLimit: false };
    if (length <= 5100) return { profileType: 'Joist Single', joistSpacing: 500, exceedsLimit: false };
    if (length <= 5850) return { profileType: 'Joist Single', joistSpacing: 400, exceedsLimit: false };
    if (length <= 7000) return { profileType: 'Joist Single', joistSpacing: 300, exceedsLimit: false };
    
    // Beyond Single C limits - use Box Joist (length > 7000)
    // Note: 7001-7700 range uses the next threshold
    if (length <= 7700) return { profileType: 'Joist Box', joistSpacing: 500, exceedsLimit: false };
    if (length <= 8350) return { profileType: 'Joist Box', joistSpacing: 400, exceedsLimit: false };
    if (length <= 9300) return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: false };
    
    // Exceeds all limits
    return { profileType: 'Joist Box', joistSpacing: 300, exceedsLimit: true };
  }
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

  // Handle kPa rating and length changes for span table logic
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Determine which length value to use for span table
      let spanLength: number | undefined;
      
      if (value.profileType === 'Bearer Single' || value.profileType === 'Bearer Box') {
        // For bearers, use joist length for span table
        spanLength = value.joistLength;
      } else if (value.profileType === 'Joist Single' || value.profileType === 'Joist Box') {
        // For joists, use profile length for span table
        spanLength = value.length;
      }
      
      // Apply span table logic when kPa rating, length, or joistLength changes
      if ((name === 'kpaRating' || name === 'length' || name === 'joistLength') && 
          value.kpaRating && 
          spanLength) {
        const recommendation = getSpanTableRecommendation(spanLength, value.kpaRating);
        
        // Show warning if exceeds limits
        if (recommendation.exceedsLimit) {
          const lengthType = (value.profileType === 'Bearer Single' || value.profileType === 'Bearer Box') ? 'Joist' : 'Profile';
          toast.warning('Exceeds span table limits', {
            description: `${lengthType} length ${spanLength}mm exceeds maximum span for ${value.kpaRating}kPa rating`
          });
        }
        
        // Only update joistSpacing if it differs
        if (value.joistSpacing !== recommendation.joistSpacing) {
          form.setValue('joistSpacing', recommendation.joistSpacing);
        }
        
        // For Joists only: auto-update profile type
        if ((value.profileType === 'Joist Single' || value.profileType === 'Joist Box') &&
            value.profileType !== recommendation.profileType) {
          form.setValue('profileType', recommendation.profileType);
          
          // Update endBoxJoist based on profile type
          if (recommendation.profileType === 'Joist Box') {
            if (!value.endBoxJoist) {
              form.setValue('endBoxJoist', true);
            }
          } else {
            if (value.endBoxJoist) {
              form.setValue('endBoxJoist', false);
            }
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  React.useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.profileType && value.profileHeight && value.length && 
          value.joistSpacing && value.stubSpacing && value.holeType && value.holeSpacing) {
        onChange(value as ProfileData);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  const isJoist = form.watch('profileType') === 'Joist Single' || form.watch('profileType') === 'Joist Box';
  const isBearer = form.watch('profileType') === 'Bearer Single' || form.watch('profileType') === 'Bearer Box';

  return (
    <Form {...form}>
      <form className="space-y-6">
        {/* REORGANIZED - Profile Type now first */}
        
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
              {isJoist && form.watch('kpaRating') && (
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-selected per span table recommendations
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="length"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profile Length (mm)</FormLabel>
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

        {/* NEW - Joist Length field (Bearer only) */}
        {isBearer && (
          <FormField
            control={form.control}
            name="joistLength"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Joist Length (mm)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    value={field.value || ''}
                    onChange={e => field.onChange(Number(e.target.value))}
                    className="text-right"
                    placeholder="Enter joist span length"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Length of joists connecting to this bearer (controls joist spacing)
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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

        {/* kPa Rating - always visible */}
        <FormField
          control={form.control}
          name="kpaRating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>kPa Rating</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || '2.5'}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select kPa rating" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="2.5">2.5 kPa</SelectItem>
                  <SelectItem value="5.0">5.0 kPa</SelectItem>
                </SelectContent>
              </Select>
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
              {isJoist && form.watch('kpaRating') && (
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-selected per span table recommendations
                </p>
              )}
              {isBearer && form.watch('kpaRating') && form.watch('joistLength') && (
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-selected per span table based on joist length
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

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

        <Separator />

        {/* Screens and Stubs Switches */}
        <div className="space-y-4">
          <FormLabel className="text-base font-medium">Special Configurations</FormLabel>
          
          {/* Screens toggle */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1 pr-4">
                <span className="text-sm font-medium">Screens</span>
                <p className="text-xs text-muted-foreground">
                  {isBearer && 'Bearer: First/last web tabs at ±475mm, intermediate at joist spacing'}
                  {isJoist && 'Joist: First/last web tabs at ±425mm, intermediate ≤1200mm, service holes between tabs'}
                </p>
              </div>
              <div className="flex-shrink-0">
                <Switch
                  checked={form.watch('screensEnabled') || false}
                  onCheckedChange={(value) => form.setValue('screensEnabled', !!value)}
                />
              </div>
            </div>
          </div>
          
          {/* Stubs On/Off toggle - only for Bearers */}
          {isBearer && (
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
          )}
        </div>
      </form>
    </Form>
  );
}