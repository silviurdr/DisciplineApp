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
      <!-- Navigation Header -->
      <nav class="main-nav">
        <div class="nav-content">
          <div class="nav-brand">
            <h1>📅 Discipline App</h1>
          </div>
          <div class="nav-links">
            <a routerLink="/" 
              routerLinkActive="active" 
              [routerLinkActiveOptions]="{exact: true}"
              class="nav-link">
              📊 Weekly
            </a>
            <a routerLink="/monthly" 
              routerLinkActive="active"
              class="nav-link">
              📅 Monthly
            </a>
            <a routerLink="/habits" 
              routerLinkActive="active"
              class="nav-link">
              ⚙️ Habits
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
  styles: [`
    .app-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f0f23, #1a1a2e);
      color: #e3f2fd;
    }

    .main-nav {
      background: rgba(20, 20, 40, 0.9);
      border-bottom: 1px solid rgba(100, 181, 246, 0.3);
      backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .nav-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 70px;
    }

    .nav-brand h1 {
      margin: 0;
      color: #64b5f6;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .nav-links {
      display: flex;
      gap: 20px;
    }

    .nav-link {
      text-decoration: none;
      color: #90caf9;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.3s ease;
      border: 1px solid transparent;
    }

    .nav-link:hover {
      background: rgba(100, 181, 246, 0.1);
      border-color: rgba(100, 181, 246, 0.3);
      transform: translateY(-1px);
    }

    .nav-link.active {
      background: rgba(100, 181, 246, 0.2);
      color: #64b5f6;
      border-color: rgba(100, 181, 246, 0.5);
    }

    .main-content {
      min-height: calc(100vh - 70px);
    }

    @media (max-width: 768px) {
      .nav-content {
        flex-direction: column;
        height: auto;
        padding: 15px 20px;
        gap: 15px;
      }

      .nav-links {
        gap: 10px;
      }

      .nav-link {
        padding: 8px 15px;
        font-size: 0.9rem;
      }

      .main-content {
        min-height: calc(100vh - 100px);
      }
    }
  `]
})
export class AppComponent {
  title = 'DisciplineApp';
}