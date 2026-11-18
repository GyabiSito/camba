import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly plates = [
    { id: 'image-cotton', x: 6.8700, y: 36.2900, w: 4.0400, h: 6.3500 },
    { id: 'image-plain', x: 6.8700, y: 43.7500, w: 4.0400, h: 6.3500 },
    { id: 'image-straight', x: 6.8700, y: 51.3100, w: 4.0400, h: 6.3500 },
    { id: 'image-classic', x: 6.8700, y: 58.4700, w: 4.0400, h: 6.3500 },
    { id: 'image-pocket', x: 6.8700, y: 65.8300, w: 4.0400, h: 6.3500 },
    { id: 'image-twill', x: 6.8700, y: 73.1900, w: 4.0400, h: 6.3500 },
    { id: 'image-over', x: 6.8700, y: 80.3400, w: 4.0400, h: 6.3500 },
    { id: 'detail-photo', x: 75.2800, y: 33.6700, w: 7.6300, h: 12.200 },
  ];
}