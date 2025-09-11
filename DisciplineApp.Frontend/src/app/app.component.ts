import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CalendarComponent } from './components/calendar/calendar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, CalendarComponent],
  template: `
    <div class="app-container">
      <app-calendar></app-calendar>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f0f23, #1a1a2e);
    }
  `]
})
export class AppComponent {
  title = 'DisciplineApp';
}