import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-delete-contact-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Kontakt löschen</h3>
          <button class="close-button" (click)="close()">×</button>
        </div>
        <div class="modal-body">
          <p>Möchten Sie den Kontakt "{{ contactName }}" wirklich löschen?</p>
          <p class="warning-text">Diese Aktion kann nicht rückgängig gemacht werden.</p>
        </div>
        <div class="modal-footer">
          <button class="cancel-button" (click)="close()">Abbrechen</button>
          <button class="delete-button" (click)="confirmDelete()">Löschen</button>
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
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        margin: 0;
        font-size: 18px;
        color: #333;
      }

      .close-button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;

        &:hover {
          background-color: #f0f0f0;
          color: #333;
        }
      }
    }

    .modal-body {
      padding: 20px;
      
      p {
        margin: 0 0 10px;
        color: #333;
      }

      .warning-text {
        color: #dc3545;
        font-size: 14px;
      }
    }

    .modal-footer {
      padding: 20px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
      gap: 12px;

      button {
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }

      .cancel-button {
        background-color: #f0f0f0;
        color: #333;

        &:hover {
          background-color: #e0e0e0;
        }
      }

      .delete-button {
        background-color: #dc3545;
        color: white;

        &:hover {
          background-color: #c82333;
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