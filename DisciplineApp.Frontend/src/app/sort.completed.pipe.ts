import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sortCompleted',
  pure: false  // Make it impure to detect array changes
})
export class SortCompletedPipe implements PipeTransform {
  transform(habits: any[] | null | undefined): any[] {
    if (!habits || habits.length === 0) {
      return [];
    }

    // CRITICAL: Always return a new array reference
    return [...habits].sort((a, b) => {
      // Sort by completion status first (incomplete tasks first)
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1; // Incomplete first
      }
      // Then sort by required status (required tasks first)
      if (a.isRequired !== b.isRequired) {
        return a.isRequired ? -1 : 1; // Required first
      }
      return 0;
    });
  }
}