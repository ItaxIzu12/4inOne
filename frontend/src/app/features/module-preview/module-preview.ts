import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface ModulePreviewData {
  label: string;
  accent: 'finance' | 'organize' | 'household';
  description: string;
}

@Component({
  selector: 'app-module-preview',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './module-preview.html',
  styleUrl: './module-preview.css',
})
export class ModulePreview {
  private readonly route = inject(ActivatedRoute);
  protected readonly data = this.route.snapshot.data as ModulePreviewData;
}
