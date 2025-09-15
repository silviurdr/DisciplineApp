// src/app/app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="app-container">
      <!-- Modern Navigation Header -->
      <nav class="main-nav">
        <div class="nav-content">
          <!-- Brand Section -->
          <div class="nav-brand">
            <h1>discipline</h1>
          </div>
          
          <!-- Navigation Links -->
          <div class="nav-links">
            <a routerLink="/" 
               routerLinkActive="active" 
               [routerLinkActiveOptions]="{exact: true}"
               class="nav-link">
              <span class="tab-icon">⌂</span>
              <span class="tab-text">Weekly</span>
            </a>
            <a routerLink="/monthly" 
               routerLinkActive="active"
               class="nav-link">
              <span class="tab-icon">☷</span>
              <span class="tab-text">Monthly</span>
            </a>
            <a routerLink="/habits" 
               routerLinkActive="active"
               class="nav-link">
              <span class="tab-icon">◯</span>
              <span class="tab-text">Habits</span>
            </a>
          </div>
        </div>
      </nav>

      <!-- Main Content Area -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'DisciplineApp';
}