package com.dynamex.service;

import com.dynamex.model.Product;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class InventoryManager {

    private final List<Product> products;          
    private volatile long lastSearchNanos = 0L;
    private volatile int  lastSearchSteps = 0;
    private volatile long lastLinearNanos = 0L;
    private volatile int  lastLinearSteps = 0;

    public InventoryManager(List<Product> sortedProducts) {
        this.products = sortedProducts;
    }

    public int size() {
        return products.size();
    }

    public List<Product> all() {
        return Collections.unmodifiableList(products);
    }

    public List<Product> page(int page, int pageSize) {
        int from = Math.max(0, page * pageSize);
        int to   = Math.min(products.size(), from + pageSize);
        if (from >= to) return new ArrayList<>();
        return new ArrayList<>(products.subList(from, to));
    }

     public FilteredResult filteredPage(String query, int page, int pageSize) {
        List<Product> filtered;

        if (query == null || query.trim().isEmpty()) {
            filtered = products;
        } else {
            String q = query.trim();
            filtered = new ArrayList<>();

            boolean isNumeric = q.matches("\\d+");
            if (isNumeric) {
                int targetId = Integer.parseInt(q);
                for (Product p : products) {
                    if (p.getId() == targetId) {
                        filtered.add(p);
                        break;
                    }
                }
            } else {
                String lower = q.toLowerCase();
                for (Product p : products) {
                    if (p.getName().toLowerCase().contains(lower)) {
                        filtered.add(p);
                    }
                }
            }
        }

        int total = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(total / (double) pageSize));
        if (page >= totalPages) page = totalPages - 1;
        if (page < 0) page = 0;

        int from = page * pageSize;
        int to   = Math.min(total, from + pageSize);
        List<Product> rows = (from >= to) ? new ArrayList<>() : new ArrayList<>(filtered.subList(from, to));

        return new FilteredResult(rows, total, totalPages);
    }

    public static class FilteredResult {
        public final List<Product> items;
        public final int total;
        public final int totalPages;

        FilteredResult(List<Product> items, int total, int totalPages) {
            this.items = items;
            this.total = total;
            this.totalPages = totalPages;
        }
    }

    public Product binarySearch(int targetID) {
        long start = System.nanoTime();
        int low = 0;
        int high = products.size() - 1;
        int steps = 0;

        while (low <= high) {
            steps++;
            int mid = low + (high - low) / 2;
            Product p = products.get(mid);

            if (p.getId() == targetID) {
                lastSearchNanos = System.nanoTime() - start;
                lastSearchSteps = steps;
                return p;
            } else if (p.getId() < targetID) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        lastSearchNanos = System.nanoTime() - start;
        lastSearchSteps = steps;
        return null;
    }

    public long getLastSearchNanos() {
        return lastSearchNanos;
    }

    public int getLastSearchSteps() {
        return lastSearchSteps;
    }
    
    public Product linearSearch(int targetID) {
        long start = System.nanoTime();
        int steps = 0;
        Product hit = null;
        for (int i = 0; i < products.size(); i++) {
            steps++;
            if (products.get(i).getId() == targetID) {
                hit = products.get(i);
                break;
            }
        }
        lastLinearNanos = System.nanoTime() - start;
        lastLinearSteps = steps;
        return hit;
    }
    public long getLastLinearNanos() {
        return lastLinearNanos;
    }
    public int getLastLinearSteps() {
        return lastLinearSteps;
    }
}
