FROM node:22-alpine
WORKDIR /app
COPY server/photos.mjs ./photos.mjs
ENV NODE_ENV=production PHOTO_DATA_DIR=/data PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/photos/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "photos.mjs"]
