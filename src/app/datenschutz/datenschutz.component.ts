import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '../shared/header/header.component';
import { FooterComponent } from '../shared/footer/footer.component';

@Component({
  selector: 'app-datenschutz',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './datenschutz.component.html',
  styleUrls: ['./datenschutz.component.scss']
})
export class DatenschutzComponent {
  private router = inject(Router);

  navigateBack(): void {
    this.router.navigate(['/login']);
  }
}
