import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {Theme} from './layout/theme/theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Theme],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
