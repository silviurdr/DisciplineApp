import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'daysLeft',
  standalone: true // Generated as standalone in a modern Angular app
})
export class DaysLeftPipe implements PipeTransform {

  transform(value: string | Date | null | undefined): number | null {
    if (!value) {
      return null; // Return null if the date is null or undefined
    }

    // Create date objects, ensuring we only compare the date part
    const deadlineDate = new Date(value);
    deadlineDate.setHours(0, 0, 0, 0); // Normalize to the start of the day

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to the start of today

    // If deadline is in the past, return a negative number
    if (deadlineDate < today) {
      // Calculate how many days ago it was
      const differenceInMs = today.getTime() - deadlineDate.getTime();
      const daysAgo = Math.floor(differenceInMs / (1000 * 60 * 60 * 24));
      return -daysAgo; // Return as negative
    }

    // Calculate the difference in milliseconds
    const differenceInMs = deadlineDate.getTime() - today.getTime();

    // Convert milliseconds to days and round up to the nearest whole number
    const daysLeft = Math.ceil(differenceInMs / (1000 * 60 * 60 * 24));

    return daysLeft;
  }
}