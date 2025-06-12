import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-delete-contact-modal',
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ])
  ],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="close()" [@modalAnimation]>
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="header-content">
            <div class="warning-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3>Kontakt löschen</h3>
          </div>
          <button class="close-button" (click)="close()">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="contact-name">"{{ contactName }}"</p>
          <p class="confirmation-text">Möchten Sie diesen Kontakt wirklich löschen?</p>
          <p class="warning-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
        </div>
        <div class="modal-footer">
          <button class="cancel-button" (click)="close()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Abbrechen
          </button>
          <button class="delete-button" (click)="confirmDelete()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Löschen
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 420px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .modal-header {
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #eee;

      .header-content {
        display: flex;
        align-items: center;
        gap: 12px;

        .warning-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #dc3545;
        }

        h3 {
          margin: 0;
          font-size: 20px;
          color: #2c3e50;
          font-weight: 600;
        }
      }

      .close-button {
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        color: #666;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;

        &:hover {
          background-color: #f8f9fa;
          color: #2c3e50;
          transform: rotate(90deg);
        }
      }
    }

    .modal-body {
      padding: 24px;
      
      .contact-name {
        font-size: 18px;
        font-weight: 600;
        color: #2c3e50;
        margin: 0 0 16px;
      }

      .confirmation-text {
        font-size: 16px;
        color: #2c3e50;
        margin: 0 0 16px;
      }

      .warning-text {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #dc3545;
        font-size: 14px;
        margin: 0;
        padding: 12px;
        background-color: rgba(220, 53, 69, 0.1);
        border-radius: 8px;

        svg {
          color: #dc3545;
        }
      }
    }

    .modal-footer {
      padding: 24px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
      gap: 12px;

      button {
        padding: 10px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-size: 14px;

        svg {
          transition: transform 0.2s ease;
        }

        &:hover svg {
          transform: scale(1.1);
        }
      }

      .cancel-button {
        background-color: #f8f9fa;
        color: #2c3e50;
        border: 1px solid #dee2e6;

        &:hover {
          background-color: #e9ecef;
          border-color: #dee2e6;
        }
      }

      .delete-button {
        background-color: #dc3545;
        color: white;

        &:hover {
          background-color: #c82333;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(220, 53, 69, 0.2);
        }

        &:active {
          transform: translateY(0);
          box-shadow: none;
        }
      }
    }
  `]
})
export class DeleteContactModalComponent {
  @Input() isVisible: boolean = false;
  @Input() contactName: string = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() confirmDeletion = new EventEmitter<void>();

  close() {
    this.closeModal.emit();
  }

  confirmDelete() {
    this.confirmDeletion.emit();
    this.close();
  }
} 