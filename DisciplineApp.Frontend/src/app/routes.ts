// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { CalendarComponent } from './components/calendar/calendar.component';
import { HabitManagementComponent } from './components/habit-management/habit-management';
import { MonthlyViewComponent } from './components/monthly-view/monthly-view';

export const routes: Routes = [
  { 
    path: '', 
    component: CalendarComponent,
    title: 'Weekly Calendar'
  },
  { 
    path: 'monthly', 
    component: MonthlyViewComponent,
    title: 'Monthly View'
  },
  { 
    path: 'habits', 
    component: HabitManagementComponent,
    title: 'Manage Habits'
  },
  { 
    path: '**', 
    redirectTo: '',
    pathMatch: 'full'
  }
];