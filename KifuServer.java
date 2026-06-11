import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class KifuServer {
    private static final int PORT = 8080;
    private static final String DATA_FILE = "kifu_data.json";
    private static final String WWWROOT = "wwwroot";
    private static final String UPLOAD_DIR = "C:\\kifu";

    public record Kifu(
            long id,
            String gameType,
            String opponent,
            String accountName,
            String result,
            String turn,
            String myStrategy,
            String opponentStrategy,
            String endReason,
            int moves,
            double badMoveRate,
            double questionableMoveRate,
            String comment,
            String matchDate,
            String kifFilePath
    ) {}

    public static void main(String[] args) throws IOException {
        // データファイルの初期化 (存在しない場合は空配列で作成)
        Path dataPath = Paths.get(DATA_FILE);
        if (!Files.exists(dataPath)) {
            Files.writeString(dataPath, "[]", StandardCharsets.UTF_8);
        }
        Files.createDirectories(Paths.get(UPLOAD_DIR));

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        
        // APIハンドラー
        server.createContext("/api/kifu", new KifuApiHandler());
        
        // 静的ファイルハンドラー
        server.createContext("/", new StaticFileHandler());

        server.setExecutor(null); // デフォルトのエグゼキュータ
        System.out.println("=== Kifu Hub Server Started ===");
        System.out.println("Open your browser and visit: http://localhost:" + PORT + "/");
        server.start();
    }

    // ==========================================================================
    // API Handler (GET /api/kifu, POST /api/kifu)
    // ==========================================================================
    static class KifuApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

            if ("OPTIONS".equalsIgnoreCase(method)) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            try {
                if ("GET".equalsIgnoreCase(method)) {
                    handleGet(exchange);
                } else if ("POST".equalsIgnoreCase(method)) {
                    handlePost(exchange);
                } else if ("PUT".equalsIgnoreCase(method)) {
                    handlePut(exchange);
                } else if ("DELETE".equalsIgnoreCase(method)) {
                    handleDelete(exchange);
                } else {
                    sendResponse(exchange, 405, "Method Not Allowed");
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, 500, "Internal Server Error: " + e.getMessage());
            }
        }

        private void handleGet(HttpExchange exchange) throws IOException {
            Path dataPath = Paths.get(DATA_FILE);
            String json = Files.exists(dataPath) ? Files.readString(dataPath, StandardCharsets.UTF_8) : "[]";
            sendJsonResponse(exchange, 200, json);
        }

        private void handlePost(HttpExchange exchange) throws IOException {
            ParsedRequest parsed;
            try {
                parsed = parseKifuRequest(exchange);
            } catch (IllegalArgumentException iae) {
                sendResponse(exchange, 400, iae.getMessage());
                return;
            }
            if (parsed == null || parsed.kifu() == null) {
                sendResponse(exchange, 400, "Invalid form data or missing fields.");
                return;
            }

            Kifu newKifu = parsed.kifu();
            MultipartPart filePart = parsed.filePart();

            // スレッドセーフにファイル読み書き
            synchronized (KifuServer.class) {
                Path dataPath = Paths.get(DATA_FILE);
                String jsonStr = Files.readString(dataPath, StandardCharsets.UTF_8);
                List<Kifu> list = deserializeKifuList(jsonStr);
                long maxId = 0;
                for (Kifu k : list) {
                    if (k.id() > maxId) maxId = k.id();
                }
                long assignedId = maxId + 1;
                String savedFilePath = newKifu.kifFilePath();
                if (filePart != null && filePart.filename() != null && !filePart.filename().isBlank() && filePart.body() != null) {
                    savedFilePath = saveUploadedFile(filePart, assignedId);
                }
                Kifu withId = new Kifu(assignedId, newKifu.gameType(), newKifu.opponent(), newKifu.accountName(), newKifu.result(), newKifu.turn(), newKifu.myStrategy(), newKifu.opponentStrategy(), newKifu.endReason(), newKifu.moves(), newKifu.badMoveRate(), newKifu.questionableMoveRate(), newKifu.comment(), newKifu.matchDate(), savedFilePath);
                list.add(withId);
                String updatedJson = serializeKifuList(list);
                Files.writeString(dataPath, updatedJson, StandardCharsets.UTF_8);
            }

            sendResponse(exchange, 201, "Created");
        }

        private void handlePut(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String[] parts = path.split("/");
            if (parts.length < 3) {
                sendResponse(exchange, 400, "Missing id in path");
                return;
            }
            String idStr = parts[parts.length - 1];
            long id;
            try {
                id = Long.parseLong(idStr);
            } catch (NumberFormatException e) {
                sendResponse(exchange, 400, "Invalid id");
                return;
            }

            ParsedRequest parsed;
            try {
                parsed = parseKifuRequest(exchange);
            } catch (IllegalArgumentException iae) {
                sendResponse(exchange, 400, iae.getMessage());
                return;
            }
            if (parsed == null || parsed.kifu() == null) {
                sendResponse(exchange, 400, "Invalid form data or missing fields.");
                return;
            }

            Kifu formKifu = parsed.kifu();
            MultipartPart filePart = parsed.filePart();

            synchronized (KifuServer.class) {
                Path dataPath = Paths.get(DATA_FILE);
                String jsonStr = Files.readString(dataPath, StandardCharsets.UTF_8);
                List<Kifu> list = deserializeKifuList(jsonStr);
                boolean found = false;
                for (int i = 0; i < list.size(); i++) {
                    if (list.get(i).id() == id) {
                        Kifu original = list.get(i);
                        String savedFilePath = original.kifFilePath();
                        if (filePart != null && filePart.filename() != null && !filePart.filename().isBlank() && filePart.body() != null) {
                            savedFilePath = saveUploadedFile(filePart, id);
                        }
                        Kifu updated = new Kifu(id, formKifu.gameType(), formKifu.opponent(), formKifu.accountName(), formKifu.result(), formKifu.turn(), formKifu.myStrategy(), formKifu.opponentStrategy(), formKifu.endReason(), formKifu.moves(), formKifu.badMoveRate(), formKifu.questionableMoveRate(), formKifu.comment(), formKifu.matchDate(), savedFilePath);
                        list.set(i, updated);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    sendResponse(exchange, 404, "Not Found");
                    return;
                }
                String updatedJson = serializeKifuList(list);
                Files.writeString(dataPath, updatedJson, StandardCharsets.UTF_8);
            }

            sendResponse(exchange, 200, "Updated");
        }

        private void handleDelete(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String[] parts = path.split("/");
            if (parts.length < 3) {
                sendResponse(exchange, 400, "Missing id in path");
                return;
            }
            String idStr = parts[parts.length - 1];
            long id;
            try {
                id = Long.parseLong(idStr);
            } catch (NumberFormatException e) {
                sendResponse(exchange, 400, "Invalid id");
                return;
            }

            synchronized (KifuServer.class) {
                Path dataPath = Paths.get(DATA_FILE);
                String jsonStr = Files.readString(dataPath, StandardCharsets.UTF_8);
                List<Kifu> list = deserializeKifuList(jsonStr);
                boolean removed = list.removeIf(k -> k.id() == id);
                if (!removed) {
                    sendResponse(exchange, 404, "Not Found");
                    return;
                }
                String updatedJson = serializeKifuList(list);
                Files.writeString(dataPath, updatedJson, StandardCharsets.UTF_8);
            }

            sendResponse(exchange, 200, "Deleted");
        }
    }

    // ==========================================================================
    // Static Files Handler
    // ==========================================================================
    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String pathStr = exchange.getRequestURI().getPath();
            if (pathStr.equals("/")) {
                pathStr = "/index.html";
            }

            Path file = Paths.get(WWWROOT, pathStr.substring(1));
            
            // 安全対策：wwwroot外のファイルを読み込ませない
            Path absoluteWwwroot = Paths.get(WWWROOT).toAbsolutePath().normalize();
            Path absoluteTarget = file.toAbsolutePath().normalize();
            if (!absoluteTarget.startsWith(absoluteWwwroot)) {
                sendResponse(exchange, 403, "Access Denied");
                return;
            }

            if (!Files.exists(file) || Files.isDirectory(file)) {
                sendResponse(exchange, 404, "Not Found");
                return;
            }

            String contentType = getContentType(file.getFileName().toString());
            exchange.getResponseHeaders().set("Content-Type", contentType);

            byte[] bytes = Files.readAllBytes(file);
            exchange.sendResponseHeaders(200, bytes.length);
            OutputStream os = exchange.getResponseBody();
            os.write(bytes);
            os.close();
        }

        private String getContentType(String filename) {
            if (filename.endsWith(".html")) return "text/html; charset=utf-8";
            if (filename.endsWith(".css")) return "text/css; charset=utf-8";
            if (filename.endsWith(".js")) return "application/javascript; charset=utf-8";
            if (filename.endsWith(".png")) return "image/png";
            if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
            if (filename.endsWith(".svg")) return "image/svg+xml";
            if (filename.endsWith(".ico")) return "image/x-icon";
            return "application/octet-stream";
        }
    }

    // ==========================================================================
    // JSON Utility Helpers (No dependencies)
    // ==========================================================================
    private static Kifu parseKifuJson(String json) {
        String idStr = extractJsonVal(json, "id");
        String gameType = extractJsonVal(json, "gameType");
        String opponent = extractJsonVal(json, "opponent");
        String result = extractJsonVal(json, "result");
        String turn = extractJsonVal(json, "turn");
        String myStrategy = extractJsonVal(json, "myStrategy");
        String opponentStrategy = extractJsonVal(json, "opponentStrategy");
        String endReason = extractJsonVal(json, "endReason");
        String accountName = extractJsonVal(json, "accountName");
        String comment = extractJsonVal(json, "comment");
        String matchDate = extractJsonVal(json, "matchDate");
        String kifFilePath = extractJsonVal(json, "kifFilePath");

        String movesStr = extractJsonVal(json, "moves");
        String badMoveRateStr = extractJsonVal(json, "badMoveRate");
        String questionableMoveRateStr = extractJsonVal(json, "questionableMoveRate");

        List<String> missing = new ArrayList<>();
        if (gameType == null || gameType.isBlank()) missing.add("gameType");
        if (opponent == null || opponent.isBlank()) missing.add("opponent");
        if (result == null || result.isBlank()) missing.add("result");
        if (turn == null || turn.isBlank()) missing.add("turn");
        if (myStrategy == null || myStrategy.isBlank()) missing.add("myStrategy");
        if (opponentStrategy == null || opponentStrategy.isBlank()) missing.add("opponentStrategy");
        if (endReason == null || endReason.isBlank()) missing.add("endReason");
        if (movesStr == null || movesStr.isBlank()) missing.add("moves");
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Missing required JSON fields: " + String.join(", ", missing));
        }

        try {
            int moves = Integer.parseInt(movesStr.trim());
            double badMoveRate = badMoveRateStr == null || badMoveRateStr.trim().isEmpty() ? 0.0 : Double.parseDouble(badMoveRateStr.trim());
            double questionableMoveRate = questionableMoveRateStr == null || questionableMoveRateStr.trim().isEmpty() ? 0.0 : Double.parseDouble(questionableMoveRateStr.trim());

            long id = 0;
            if (idStr != null) {
                try { id = Long.parseLong(idStr.trim()); } catch (Exception ignored) {}
            }

            if (accountName == null) accountName = "";
            if (comment == null) comment = "";
            if (matchDate == null) matchDate = "";

            return new Kifu(id, gameType, opponent, accountName, result, turn, myStrategy, opponentStrategy, endReason, moves, badMoveRate, questionableMoveRate, comment, matchDate, kifFilePath);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid numeric value in JSON (moves/badMoveRate/questionableMoveRate)");
        }
    }

    private static String extractJsonVal(String json, String key) {
        // キーに対する文字列もしくは数値を取り出す簡易パターンマッチング
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*(?:\"([^\"]*)\"|([\\d\\.-]+))");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            if (matcher.group(1) != null) {
                return matcher.group(1); // ダブルクォーテーションで囲まれた文字列
            } else {
                return matcher.group(2); // 数値
            }
        }
        return null;
    }

    private static List<Kifu> deserializeKifuList(String json) {
        List<Kifu> list = new ArrayList<>();
        if (json == null || json.trim().isEmpty() || json.equals("[]")) {
            return list;
        }

        // オブジェクトごとに分割する簡易パース
        // 各要素が {"gameType":..., } のような形になっていると仮定
        Pattern pattern = Pattern.compile("\\{[^\\}]+\\}");
        Matcher matcher = pattern.matcher(json);
        while (matcher.find()) {
            Kifu k = parseKifuJson(matcher.group());
            if (k != null) {
                list.add(k);
            }
        }
        return list;
    }

    private static String serializeKifuList(List<Kifu> list) {
        StringBuilder sb = new StringBuilder();
        sb.append("[\n");
        for (int i = 0; i < list.size(); i++) {
            Kifu k = list.get(i);
            sb.append(String.format(
                "  {\n" +
                "    \"id\": %d,\n" +
                "    \"gameType\": \"%s\",\n" +
                "    \"opponent\": \"%s\",\n" +
                "    \"accountName\": \"%s\",\n" +
                "    \"result\": \"%s\",\n" +
                "    \"turn\": \"%s\",\n" +
                "    \"myStrategy\": \"%s\",\n" +
                "    \"opponentStrategy\": \"%s\",\n" +
                "    \"endReason\": \"%s\",\n" +
                "    \"moves\": %d,\n" +
                "    \"badMoveRate\": %.2f,\n" +
                "    \"questionableMoveRate\": %.2f,\n" +
                "    \"matchDate\": \"%s\",\n" +
                "    \"comment\": \"%s\",\n" +
                "    \"kifFilePath\": \"%s\"\n" +
                "  }",
                k.id(), escapeJson(k.gameType()), escapeJson(k.opponent()), escapeJson(k.accountName()), escapeJson(k.result()), escapeJson(k.turn()),
                escapeJson(k.myStrategy()), escapeJson(k.opponentStrategy()), escapeJson(k.endReason()),
                k.moves(), k.badMoveRate(), k.questionableMoveRate(), escapeJson(k.matchDate()), escapeJson(k.comment()), escapeJson(k.kifFilePath())
            ));
            if (i < list.size() - 1) {
                sb.append(",");
            }
            sb.append("\n");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    // ==========================================================================
    // Response Helpers
    // ==========================================================================
    private static void sendResponse(HttpExchange exchange, int statusCode, String message) throws IOException {
        byte[] bytes = message.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }

    private static void sendJsonResponse(HttpExchange exchange, int statusCode, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }

    private static record MultipartPart(String name, String filename, String contentType, byte[] body) {}
    private static record ParsedRequest(Kifu kifu, MultipartPart filePart) {}

    private static ParsedRequest parseKifuRequest(HttpExchange exchange) throws IOException {
        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        byte[] bodyBytes = exchange.getRequestBody().readAllBytes();
        if (contentType != null && contentType.startsWith("multipart/form-data")) {
            String boundary = null;
            for (String part : contentType.split(";")) {
                part = part.trim();
                if (part.startsWith("boundary=")) {
                    boundary = part.substring("boundary=".length());
                    break;
                }
            }
            if (boundary == null) {
                return null;
            }
            Map<String, MultipartPart> parts = parseMultipart(bodyBytes, boundary);
            Kifu formKifu = parseKifuForm(parts);
            MultipartPart filePart = parts.get("kifFile");
            return new ParsedRequest(formKifu, filePart);
        }

        String body = new String(bodyBytes, StandardCharsets.UTF_8);
        Kifu parsed = parseKifuJson(body);
        return new ParsedRequest(parsed, null);
    }

    private static Kifu parseKifuForm(Map<String, MultipartPart> parts) {
        String gameType = getPartValue(parts, "gameType");
        String opponent = getPartValue(parts, "opponent");
        String accountName = getPartValue(parts, "accountName");
        String result = getPartValue(parts, "result");
        String turn = getPartValue(parts, "turn");
        String myStrategy = getPartValue(parts, "myStrategy");
        String opponentStrategy = getPartValue(parts, "opponentStrategy");
        String endReason = getPartValue(parts, "endReason");
        String comment = getPartValue(parts, "comment");
        String matchDate = getPartValue(parts, "matchDate");
        String movesStr = getPartValue(parts, "moves");
        String badMoveRateStr = getPartValue(parts, "badMoveRate");
        String questionableMoveRateStr = getPartValue(parts, "questionableMoveRate");

        List<String> missing = new ArrayList<>();
        if (gameType == null || gameType.isBlank()) missing.add("gameType");
        if (opponent == null || opponent.isBlank()) missing.add("opponent");
        if (accountName == null || accountName.isBlank()) missing.add("accountName");
        if (result == null || result.isBlank()) missing.add("result");
        if (turn == null || turn.isBlank()) missing.add("turn");
        if (myStrategy == null || myStrategy.isBlank()) missing.add("myStrategy");
        if (opponentStrategy == null || opponentStrategy.isBlank()) missing.add("opponentStrategy");
        if (endReason == null || endReason.isBlank()) missing.add("endReason");
        if (movesStr == null || movesStr.isBlank()) missing.add("moves");
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Missing required fields: " + String.join(", ", missing));
        }

        try {
            int moves = Integer.parseInt(movesStr.trim());
            double badMoveRate = badMoveRateStr == null || badMoveRateStr.trim().isEmpty() ? 0.0 : Double.parseDouble(badMoveRateStr.trim());
            double questionableMoveRate = questionableMoveRateStr == null || questionableMoveRateStr.trim().isEmpty() ? 0.0 : Double.parseDouble(questionableMoveRateStr.trim());
            return new Kifu(0, gameType, opponent, accountName, result, turn, myStrategy, opponentStrategy, endReason, moves, badMoveRate, questionableMoveRate, comment != null ? comment : "", matchDate != null ? matchDate : "", null);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid numeric value in form fields (moves/badMoveRate/questionableMoveRate)");
        }
    }

    private static String getPartValue(Map<String, MultipartPart> parts, String name) {
        MultipartPart part = parts.get(name);
        if (part == null || part.body() == null) return null;
        return new String(part.body(), StandardCharsets.UTF_8).trim();
    }

    private static Map<String, MultipartPart> parseMultipart(byte[] bodyBytes, String boundary) throws IOException {
        Map<String, MultipartPart> result = new HashMap<>();
        String bodyStr = new String(bodyBytes, StandardCharsets.ISO_8859_1);
        String[] rawParts = bodyStr.split("--" + Pattern.quote(boundary));
        for (String rawPart : rawParts) {
            if (rawPart == null || rawPart.isBlank() || rawPart.equals("--") || rawPart.equals("--\r\n")) {
                continue;
            }
            String trimmed = rawPart;
            if (trimmed.startsWith("\r\n")) {
                trimmed = trimmed.substring(2);
            }
            if (trimmed.endsWith("\r\n")) {
                trimmed = trimmed.substring(0, trimmed.length() - 2);
            }
            int headerEnd = trimmed.indexOf("\r\n\r\n");
            if (headerEnd == -1) continue;
            String headerText = trimmed.substring(0, headerEnd);
            int bodyStart = headerEnd + 4;
            byte[] partBytes = trimmed.getBytes(StandardCharsets.ISO_8859_1);
            byte[] partBody = new byte[partBytes.length - bodyStart];
            System.arraycopy(partBytes, bodyStart, partBody, 0, partBody.length);
            if (partBody.length >= 2 && partBody[partBody.length - 2] == '\r' && partBody[partBody.length - 1] == '\n') {
                byte[] tmp = new byte[partBody.length - 2];
                System.arraycopy(partBody, 0, tmp, 0, tmp.length);
                partBody = tmp;
            }
            String disposition = null;
            String contentType = null;
            for (String headerLine : headerText.split("\r\n")) {
                String lower = headerLine.toLowerCase();
                if (lower.startsWith("content-disposition:")) {
                    disposition = headerLine;
                } else if (lower.startsWith("content-type:")) {
                    contentType = headerLine.substring(headerLine.indexOf(":") + 1).trim();
                }
            }
            if (disposition == null) continue;
            String name = null;
            String filename = null;
            Pattern dispPattern = Pattern.compile("name=\"([^\"]+)\"");
            Matcher matcher = dispPattern.matcher(disposition);
            if (matcher.find()) {
                name = matcher.group(1);
            }
            Pattern filePattern = Pattern.compile("filename=\"([^\"]*)\"");
            matcher = filePattern.matcher(disposition);
            if (matcher.find()) {
                filename = matcher.group(1);
            }
            result.put(name, new MultipartPart(name, filename, contentType, partBody));
        }
        return result;
    }

    private static String saveUploadedFile(MultipartPart filePart, long id) throws IOException {
        String originalName = filePart.filename();
        String sanitized = sanitizeFileName(originalName != null ? originalName : "upload.kif");
        String filename = String.format("kifu_%d_%d_%s", id, System.currentTimeMillis(), sanitized);
        Path savePath = Paths.get(UPLOAD_DIR, filename);
        Files.write(savePath, filePart.body());
        return savePath.toAbsolutePath().toString();
    }

    private static String sanitizeFileName(String filename) {
        return filename.replaceAll("[\\\\/:*?\"<>|]", "_").replaceAll("\\s+", "_");
    }
}
