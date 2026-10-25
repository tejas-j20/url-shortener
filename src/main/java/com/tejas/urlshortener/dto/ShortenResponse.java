package com.tejas.urlshortener.dto;

public record ShortenResponse (
    String originalUrl,
    String shortLink,
    String fullShortUrl,
    String createdAt
) {

}
