// Fixed app.component.ts - Replace your existing file
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
               (click)="navigateToRoute('/')">
              <span class="tab-icon">⌂</span>
              <span class="tab-text">Weekly</span>
            </a>
            <a routerLink="/monthly" 
               routerLinkActive="active"
               class="nav-link"
               (click)="navigateToRoute('/monthly')">
              <span class="tab-icon">☷</span>
              <span class="tab-text">Monthly</span>
            </a>
            <a routerLink="/habits" 
               routerLinkActive="active"
               class="nav-link"
               (click)="navigateToRoute('/habits')">
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
    // Listen for navigation end to hide loading
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Hide app-level loading when navigation completes
      // Let individual components manage their own loading
      setTimeout(() => {
        this.loadingService.hide();
      }, 100);
    });
  }

  // FIXED: Simplified navigation without conflicting loading states
  navigateToRoute(route: string) {
    // Don't show loading here - let the components handle it
    // This prevents the loading conflict
    this.router.navigate([route]);
  }
}