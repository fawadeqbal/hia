import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role, type CustomerOrderNoteDto, type OrderNoteDto } from '@ecommerce/types';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DocumentsService, type PdfFile } from './documents.service';
import { OrderNoteDtoBody } from './dto/note.dto';
import { OrderNotesService } from './notes.service';

function sendPdf(res: Response, file: PdfFile): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.buffer);
}

@ApiTags('Orders · Documents')
@ApiBearerAuth()
@Controller('orders')
export class CustomerDocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly notes: OrderNotesService,
  ) {}

  @Get(':orderNumber/invoice')
  async invoice(
    @CurrentUser('sub') userId: string,
    @Param('orderNumber') orderNumber: string,
    @Res() res: Response,
  ): Promise<void> {
    sendPdf(res, await this.docs.customerInvoice(userId, orderNumber));
  }

  @Get(':orderNumber/notes')
  customerNotes(
    @CurrentUser('sub') userId: string,
    @Param('orderNumber') orderNumber: string,
  ): Promise<CustomerOrderNoteDto[]> {
    return this.notes.customerList(userId, orderNumber);
  }
}

@ApiTags('Vendor · Order documents')
@ApiBearerAuth()
@Roles(Role.VENDOR)
@Controller('vendor/orders')
export class VendorDocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly notes: OrderNotesService,
  ) {}

  @Get(':id/invoice')
  async invoice(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    sendPdf(res, await this.docs.vendorInvoice(userId, id));
  }

  @Get(':id/packing-slip')
  async packingSlip(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    sendPdf(res, await this.docs.vendorPackingSlip(userId, id));
  }

  @Get(':id/notes')
  list(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<OrderNoteDto[]> {
    return this.notes.vendorList(userId, id);
  }

  @Post(':id/notes')
  add(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: OrderNoteDtoBody,
  ): Promise<OrderNoteDto> {
    return this.notes.vendorAdd(userId, id, dto);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    return this.notes.vendorRemove(userId, id, noteId);
  }
}

@ApiTags('Admin · Order documents')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPPORT_AGENT)
@Controller('admin/orders')
export class AdminDocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly notes: OrderNotesService,
  ) {}

  @Get(':id/invoice')
  async invoice(@Param('id') id: string, @Res() res: Response): Promise<void> {
    sendPdf(res, await this.docs.adminInvoice(id));
  }

  @Get(':id/packing-slip')
  async packingSlip(@Param('id') id: string, @Res() res: Response): Promise<void> {
    sendPdf(res, await this.docs.adminPackingSlip(id));
  }

  @Get(':id/notes')
  list(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<OrderNoteDto[]> {
    return this.notes.adminList(id, actorId);
  }

  @Post(':id/notes')
  add(
    @Param('id') id: string,
    @Body() dto: OrderNoteDtoBody,
    @CurrentUser('sub') actorId: string,
  ): Promise<OrderNoteDto> {
    return this.notes.adminAdd(id, dto, actorId);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<void> {
    return this.notes.adminRemove(id, noteId, actorId);
  }
}
