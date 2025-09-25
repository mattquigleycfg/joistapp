// default React import removed
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExportData } from '@/types/form-types';
import { FileText, File } from 'lucide-react';

const exportSchema = z.object({
  quantity: z.number().min(1).max(999),
  programName: z.string().min(1).max(50)
});

interface ExportFormProps {
  data: ExportData;
  onChange: (data: ExportData) => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export function ExportForm({ data, onChange, onExportCSV, onExportPDF }: ExportFormProps) {
  const form = useForm<ExportData>({
    resolver: zodResolver(exportSchema),
    values: data
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.quantity && value.programName) {
        onChange(value as ExportData);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <Form {...form}>
      <form className="space-y-6">
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
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
          name="programName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Program Name (Auto-generated)</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  readOnly
                  className="bg-gray-50 cursor-not-allowed"
                  title="Program name is automatically generated from profile settings"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 pt-4">
          <Button 
            type="button" 
            onClick={onExportCSV}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <File className="h-4 w-4 mr-2" />
            Export NC File (CSV)
          </Button>
          
          <Button 
            type="button" 
            onClick={onExportPDF}
            variant="outline"
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export Drawing (PDF)
          </Button>
        </div>
      </form>
    </Form>
  );
}