import { Injectable } from '@angular/core';// sound.service.ts
@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private soundEnabled = true;

  playTaskCompleted() {
    if (this.soundEnabled) {
      this.playSound('task-complete.wav');
    }
  }

  playDayCompleted() {
    if (this.soundEnabled) {
      this.playSound('day-complete.wav');
    }
  }

  private playSound(filename: string) {
    const audio = new Audio(`assets/sounds/${filename}`);
    audio.volume = 0.7; // Adjust volume
    audio.play().catch(error => {
      console.log('Sound playback failed:', error);
    });
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
  }
}