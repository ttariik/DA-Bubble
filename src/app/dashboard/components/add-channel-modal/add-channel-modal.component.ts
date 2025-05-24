import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-add-channel-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-channel-modal.component.html',
  styleUrls: ['./add-channel-modal.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('scaleInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-30px) scale(0.95)' }),
        animate('400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', 
          style({ opacity: 0, transform: 'translateY(30px) scale(0.95)' }))
      ])
    ])
  ]
})
export class AddChannelModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();
  @Output() channelCreated = new EventEmitter<{name: string, description: string}>();
  @ViewChild('nameInput') nameInput!: ElementRef;

  channelForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.channelForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
      description: ['']
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && changes['isVisible'].currentValue === true) {
      // Wenn das Modal geöffnet wird, setzen wir einen Timer, um nach dem Rendern den Fokus zu setzen
      setTimeout(() => {
        if (this.nameInput) {
          this.nameInput.nativeElement.focus();
        }
      }, 100);
    }
  }

  closeModal(event: MouseEvent): void {
    event.preventDefault();
    this.channelForm.reset();
    this.close.emit();
  }

  createChannel(): void {
    if (this.channelForm.valid) {
      this.channelCreated.emit(this.channelForm.value);
      this.channelForm.reset();
      this.close.emit();
    } else {
      this.markFormGroupTouched(this.channelForm);
    }
  }

  // Helfer-Methode, um alle FormControls als touched zu markieren
  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      control.markAsDirty();
    });
  }

  // Prüft, ob ein Fehler für ein Feld angezeigt werden soll
  shouldShowError(controlName: string): boolean {
    const control = this.channelForm.get(controlName);
    return control ? (control.invalid && (control.dirty || control.touched)) : false;
  }

  // Berechnet die aktuelle Anzahl der Zeichen im Eingabefeld
  getCharCount(controlName: string): number {
    const control = this.channelForm.get(controlName);
    return control ? (control.value?.length || 0) : 0;
  }

  // Prüft, ob die Zeichenanzahl nahe am Limit ist (80% oder mehr)
  isNearCharLimit(controlName: string): boolean {
    if (controlName === 'name') {
      const currentLength = this.getCharCount(controlName);
      return currentLength >= 16 && currentLength < 20; // 80% von 20 Zeichen
    }
    return false;
  }

  // Prüft, ob die Zeichenanzahl das Limit erreicht hat
  isAtCharLimit(controlName: string): boolean {
    if (controlName === 'name') {
      return this.getCharCount(controlName) >= 20;
    }
    return false;
  }
}
