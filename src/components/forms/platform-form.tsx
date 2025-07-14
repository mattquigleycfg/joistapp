import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PlatformData } from '@/types/form-types';

const platformSchema = z.object({
  width: z.number().min(1000).max(50000),
  span: z.number().min(1000).max(25000),
  bays: z.number().min(1).max(20),
  pitch: z.number().min(500).max(5000)
});

interface PlatformFormProps {
  data: PlatformData;
  onChange: (data: PlatformData) => void;
}

export function PlatformForm({ data, onChange }: PlatformFormProps) {
  const form = useForm<PlatformData>({
    resolver: zodResolver(platformSchema),
    values: data
  });

  const onSubmit = (values: PlatformData) => {
    onChange(values);
  };

  React.useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.width && value.span && value.bays && value.pitch) {
        onChange(value as PlatformData);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="width"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Width (mm)</FormLabel>
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
          name="span"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Span (mm)</FormLabel>
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
          name="bays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bays</FormLabel>
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
          name="pitch"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pitch (mm)</FormLabel>
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
      </form>
    </Form>
  );
}