import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sortCompleted'
})
export class SortCompletedPipe implements PipeTransform {
  transform(habits: any[] | null | undefined): any[] {
    if (!habits) {
      return [];
    }

    // Create a copy to avoid mutating the original array
    return [...habits].sort((a, b) => {
      // The sort() function treats booleans as numbers (false=0, true=1).
      // This automatically places false (0) before true (1).
      return a.isCompleted - b.isCompleted;
    });
  }
}