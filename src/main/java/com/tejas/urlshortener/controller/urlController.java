package com.tejas.urlshortener.controller;

import org.springframework.web.bind.annotation.*;
import com.tejas.urlshortener.model.url;
import com.tejas.urlshortener.service.urlService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
public class urlController {

    private final urlService myService;

    public urlController(urlService myService) {
        this.myService = myService;
    }

    @PostMapping("/api/shorten")
    public ResponseEntity<String> shortenUrl(@RequestBody Map<String, String> request){
        String originalUrl = request.get("url");
        url savedurl = myService.generateShortLink(originalUrl);
        String shortLinkUrl = "http://localhost:8080" + savedurl.getShortLink();
        return ResponseEntity.ok(shortLinkUrl);
    }

    @GetMapping("/{shortLink}")
    public ResponseEntity<Void> redirect(@PathVariable String shortLink){
        url url = urlService.getEncodedUrl(shortLink);
        if(url == null){
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url.getOriginalURL())).build();
    }
}
