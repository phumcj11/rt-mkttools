import { apiRequest } from './api';
import type { Category, Product, ProductInput } from './types';

export function listProducts() {
  return apiRequest<Product[]>('/products');
}

export function createProduct(input: ProductInput) {
  return apiRequest<Product>('/products', { method: 'POST', body: input });
}

export function updateProduct(id: number, input: Partial<ProductInput>) {
  return apiRequest<Product>(`/products/${id}`, { method: 'PATCH', body: input });
}

export function deleteProduct(id: number) {
  return apiRequest<{ message: string }>(`/products/${id}`, { method: 'DELETE' });
}

export function listCategories() {
  return apiRequest<Category[]>('/categories');
}

export function createCategory(name: string) {
  return apiRequest<Category>('/categories', { method: 'POST', body: { name } });
}

export function deleteCategory(id: number) {
  return apiRequest<{ message: string }>(`/categories/${id}`, { method: 'DELETE' });
}
