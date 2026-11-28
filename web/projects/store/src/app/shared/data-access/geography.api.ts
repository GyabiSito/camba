import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { Data } from './api-contracts';
import { LocationOption } from '../ui/location-picker';

@Injectable({ providedIn: 'root' })
export class GeographyApi {
  private readonly client = inject(ApiClient);
  departments() { return this.client.get<Data<LocationOption[]>>('/api/v1/geography/departments'); }
  localities(departmentId: number) { return this.client.get<Data<LocationOption[]>>('/api/v1/geography/departments/' + departmentId + '/localities'); }
}
