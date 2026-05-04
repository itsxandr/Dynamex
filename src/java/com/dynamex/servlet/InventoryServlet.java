package com.dynamex.servlet;

import com.dynamex.model.Product;
import com.dynamex.service.AppState;
import com.dynamex.service.InventoryManager;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;

@WebServlet("/api/inventory")
public class InventoryServlet extends HttpServlet {

    private static final int DEFAULT_SIZE = 50;
    private static final int MAX_SIZE     = 200;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        InventoryManager im = AppState.getInstance().getInventory();
        if (im == null) {
            JsonUtil.error(resp, 503, "Inventory not loaded");
            return;
        }

        int page = parseInt(req.getParameter("page"), 1);
        int size = parseInt(req.getParameter("size"), DEFAULT_SIZE);
        if (size <= 0)      size = DEFAULT_SIZE;
        if (size > MAX_SIZE) size = MAX_SIZE;
        if (page < 1)       page = 1;

        String query = req.getParameter("q");

        InventoryManager.FilteredResult result = im.filteredPage(query, page - 1, size);

        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"page\":").append(page).append(",");
        sb.append("\"size\":").append(size).append(",");
        sb.append("\"total\":").append(result.total).append(",");
        sb.append("\"totalPages\":").append(result.totalPages).append(",");
        sb.append("\"items\":[");
        List<Product> rows = result.items;
        for (int i = 0; i < rows.size(); i++) {
            if (i > 0) {
                sb.append(",");
            }
            sb.append(rows.get(i).toJson());
        }
        sb.append("]");
        sb.append("}");

        JsonUtil.write(resp, sb.toString());
    }

    private static int parseInt(String s, int dflt) {
        if (s == null || s.isEmpty()) {
            return dflt;
        }
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return dflt;
        }
    }
}
