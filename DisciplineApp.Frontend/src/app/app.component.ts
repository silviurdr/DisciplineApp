// Update your existing app.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { LoadingService } from './services/loading.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="app-container">
      <!-- Navigation with loading state -->
      <nav class="main-nav" [class.loading]="(loadingService.loading$ | async)">
        <div class="nav-content">
          <div class="nav-brand">
            <h1>discipline</h1>
          </div>
          
          <div class="nav-links">
            <a routerLink="/" 
               routerLinkActive="active" 
               [routerLinkActiveOptions]="{exact: true}"
               class="nav-link"
               (click)="navigateWithLoading('/')">
              <span class="tab-icon">⌂</span>
              <span class="tab-text">Weekly</span>
            </a>
            <a routerLink="/monthly" 
               routerLinkActive="active"
               class="nav-link"
               (click)="navigateWithLoading('/monthly')">
              <span class="tab-icon">☷</span>
              <span class="tab-text">Monthly</span>
            </a>
            <a routerLink="/habits" 
               routerLinkActive="active"
               class="nav-link"
               (click)="navigateWithLoading('/habits')">
              <span class="tab-icon">◯</span>
              <span class="tab-text">Habits</span>
            </a>
          </div>
        </div>
      </nav>

      <!-- Loading overlay -->
      <div class="loading-overlay" *ngIf="loadingService.loading$ | async">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>

      <!-- Main content with fade transition -->
      <main class="main-content" [class.loading]="(loadingService.loading$ | async)">
        <div class="content-wrapper">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(
    public loadingService: LoadingService,
    private router: Router
  ) {}

  ngOnInit() {
    // Show loading on route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Brief delay to ensure smooth transition
      setTimeout(() => this.loadingService.hide(), 300);
    });
  }

  navigateWithLoading(route: string) {
    this.loadingService.show();
    // Small delay for visual feedback
    setTimeout(() => {
      this.router.navigate([route]);
    }, 100);
  }
}

// Add these styles to your existing app.component.scss: