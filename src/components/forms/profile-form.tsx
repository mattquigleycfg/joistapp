import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ProfileData, PunchStationType } from '@/types/form-types';
import { Checkbox } from '@/components/ui/checkbox';

const profileSchema = z.object({
  profileType: z.enum(['Joist', 'Bearer']),
  profileHeight: z.number().min(200).max(500),
  length: z.number().min(1000).max(15000),
  joistSpacing: z.number().min(400).max(1200),
  stubSpacing: z.number().min(600).max(2400),
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
                  // When switching to Joist, default the hole type to 200 mm round
                  if (value === 'Joist' && form.getValues('holeType') !== '200mm') {
                    form.setValue('holeType', '200mm');
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
                  <SelectItem value="Joist">Joist</SelectItem>
                  <SelectItem value="Bearer">Bearer</SelectItem>
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
              <FormLabel>Joist Spacing (mm)</FormLabel>
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
        {form.watch('profileType') === 'Bearer' && (
          <FormField
            control={form.control}
            name="stubPositions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stub Positions (mm, comma separated)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 1500, 3000, 4500"
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

        {/* End / Box Joist checkbox visible for Joist */}
        {form.watch('profileType') === 'Joist' && (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={form.watch('endBoxJoist') || false}
              onCheckedChange={(value) => form.setValue('endBoxJoist', !!value)}
            />
            <span className="text-sm">End / Box Joist</span>
          </div>
        )}

        {/* Punch Station Selection */}
        <div className="space-y-2">
          <FormLabel>Punch Stations</FormLabel>
          {(['BOLT HOLE','DIMPLE','WEB TAB','M SERVICE HOLE','SMALL SERVICE HOLE'] as PunchStationType[]).map((station) => {
            const index = form.getValues('punchStations').findIndex(ps => ps.station === station);
            const checked = index !== -1 ? form.getValues('punchStations')[index].enabled : false;
            return (
              <div key={station} className="flex items-center space-x-2">
                <Checkbox
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
                <span>{station}</span>
              </div>
            )
          })}
        </div>
      </form>
    </Form>
  );
}