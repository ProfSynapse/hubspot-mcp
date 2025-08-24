'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface TimeFilterProps {
  value: number;
  onValueChange: (value: number) => void;
}

const timeOptions = [
  { value: 1, label: 'Last 24 hours' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
];

export function TimeFilter({ value, onValueChange }: TimeFilterProps) {
  return (
    <div className="flex items-center space-x-2">
      <Label htmlFor="time-filter" className="text-sm font-medium">
        Time period:
      </Label>
      <Select
        value={value.toString()}
        onValueChange={(val) => onValueChange(parseInt(val))}
      >
        <SelectTrigger id="time-filter" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {timeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value.toString()}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}