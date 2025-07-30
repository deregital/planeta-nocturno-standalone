'use client';
import {
  useState,
  useEffect,
  type HTMLInputTypeAttribute,
  useCallback,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import BuyTicketsModal from './BuyTicketsModal';
import { trpc } from '@/server/trpc/client';
import { Separator } from '@/components/ui/separator';

interface TicketPurchaseModalProps {
  isOpen: boolean;
  onClose: (bought: boolean) => void;
  quantity: string;
  isFree: boolean;
  eventId: string;
  ticketType: string;
  ticketGroupId: string;
}

// Define the PDF data type based on the API response
type PdfData = {
  ticketId: string;
  pdfBase64: string;
}[];

function defaultState(ticketCount: number) {
  return {
    nombre: '',
    apellido: '',
    email: '',
    dni: '',
    additionalTickets: Array(Math.max(0, ticketCount - 1)).fill(''),
    additionalDnis: Array(Math.max(0, ticketCount - 1)).fill(''),
    referralCode: '',
  } as {
    nombre: string;
    apellido: string;
    email: string;
    dni: string;
    additionalTickets: string[];
    additionalDnis: string[];
    referralCode: string;
  };
}

function TicketPurchaseModal({
  isOpen,
  onClose,
  quantity,
  isFree,
  ticketType,
  eventId,
  ticketGroupId,
}: TicketPurchaseModalProps) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pdfData, setPdfData] = useState<PdfData>([]);
  const [ticketGroupIdCreated, setTicketGroupIdCreated] = useState<
    string | undefined
  >(undefined);

  const createManyTickets = trpc.tickets.createMany.useMutation({
    onSuccess: (data) => {
      if (data && isFree) {
        setErrorMessage('');
        setTicketGroupIdCreated(data[0].ticketGroupId ?? undefined);
      }
    },
    onError: (error) => {
      setErrorMessage(
        'Se ha producido un error al comprar los tickets. Vuelva a intentarlo.',
      );
    },
  });
  // const createPreference = trpc.mercadopago.createPreference.useMutation({
  //   onSuccess: async (data) => {
  //     if ('init_point' in data.response) {
  //       await submitTickets();
  //       window.location.href = data.response.init_point as string;
  //     } else {
  //       setErrorMessage(
  //         'Hubo un error al crear el link de pago para la compra de los tickets. Por favor, intente nuevamente.',
  //       );
  //     }
  //   },
  //   onError: (error) => {
  //     const errors = Object.values(error.data?.zodError?.fieldErrors ?? {})[0];

  //     setErrorMessage(
  //       errors?.[0] ||
  //         'Se ha producido un error al comprar los tickets. Vuelva a intentarlo.',
  //     );
  //   },
  // });

  // Obtener los pdfs de los tickets
  const { data: pdfs, isLoading: isLoadingPdf } =
    trpc.ticketGroup.getPdf.useQuery(ticketGroupIdCreated ?? '', {
      enabled: isFree && !!ticketGroupIdCreated,
    });

  const handleClose = useCallback(
    (bought: boolean) => {
      setErrorMessage('');
      onClose(bought);
    },
    [onClose],
  );

  useEffect(() => {
    if (pdfs?.pdfs) {
      setPdfData(pdfs.pdfs);
      setShowSuccessModal(true);
      handleClose(true);
    }
  }, [handleClose, pdfs]);

  const ticketsCount = parseInt(quantity, 10);

  const [formData, setFormData] = useState<ReturnType<typeof defaultState>>(
    defaultState(ticketsCount),
  );

  useEffect(() => {
    setFormData(defaultState(ticketsCount));
  }, [ticketsCount, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleAdditionalTicketChange = (index: number, value: string) => {
    const newAdditionalTickets = [...formData.additionalTickets];
    newAdditionalTickets[index] = value;

    setFormData({
      ...formData,
      additionalTickets: newAdditionalTickets,
    });
  };

  const handleAdditionalDniChange = (index: number, value: string) => {
    const newAdditionalDnis = [...formData.additionalDnis];
    newAdditionalDnis[index] = value;

    setFormData({
      ...formData,
      additionalDnis: newAdditionalDnis,
    });
  };

  const submitTickets = async () => {
    if (quantity === '1') {
      // await createManyTickets.mutateAsync([
      //   {
      //     eventId: eventId,
      //     ticketGroupId: ticketGroupId,
      //     type: ticketType,
      //     fullName: formData.nombre
      //       ? formData.nombre.length > 0
      //         ? formData.nombre + ' ' + formData.apellido
      //         : formData.apellido
      //       : formData.apellido,
      //     mail: formData.email,
      //     dni: formData.dni,
      //   },
      // ]);
    } else {
      // await createManyTickets.mutateAsync([
      //   {
      //     eventId: eventId,
      //     ticketGroupId: ticketGroupId,
      //     type: ticketType,
      //     fullName: formData.nombre + ' ' + formData.apellido,
      //     mail: formData.email,
      //     dni: formData.dni,
      //   },
      //   ...formData.additionalTickets.map((ticket, index) => ({
      //     ticketGroupId: ticketGroupId,
      //     eventId: eventId,
      //     type: ticketType,
      //     fullName: ticket,
      //     mail: formData.email,
      //     dni: formData.additionalDnis[index],
      //   })),
      // ]);
    }
  };

  const handleSubmit = async () => {
    if (isFree) {
      try {
        if (
          !formData.nombre ||
          formData.additionalTickets.some((t) => t.length === 0)
        ) {
          setErrorMessage('El nombre del titular de la entrada es obligatorio');
          return;
        }

        if (formData.additionalDnis.some((d) => d.length === 0)) {
          setErrorMessage('El DNI del titular de la entrada es obligatorio');
          return;
        }

        if (!formData.apellido) {
          setErrorMessage(
            'El apellido del titular de la entrada es obligatorio',
          );
          return;
        }
        // if (formData.referralCode) {
        //   const isValid = await isReferralCodeValid.refetch();
        //   if (!isValid.data?.exists) {
        //     setErrorMessage(
        //       'El código de referido no corresponde a ningún usuario',
        //     );
        //     return;
        //   }
        // }
        await submitTickets();
        // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
      } catch (error) {}
    } else if (!isFree) {
      // await createPreference.mutateAsync({
      //   ticket_group_id: ticketGroupId,
      //   ticket_type: ticketType,
      // });
    } else {
      setErrorMessage(
        'Hubo un error al crear los tickets. Por favor, intente nuevamente.',
      );
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setPdfData([]);
    setTicketGroupIdCreated(undefined);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => handleClose(false)}>
        <DialogContent className='bg-MiExpo_white rounded-[20px] p-6 max-w-sm mx-auto max-h-[90vh]'>
          <DialogHeader className='mb-2'>
            <DialogTitle className='text-lg font-medium text-MiExpo_black'>
              Confirmación de tickets
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-6 mt-4 overflow-y-auto pr-2 max-h-[calc(90vh-100px)]'>
            <InputWithLabel
              label='Nombre del titular de la entrada 1'
              value={formData.nombre}
              onChange={handleChange}
              name='nombre'
            />
            <InputWithLabel
              label='Apellido del titular de la entrada 1'
              value={formData.apellido}
              onChange={handleChange}
              name='apellido'
            />
            <InputWithLabel
              label='Mail del titular de las entradas'
              value={formData.email}
              onChange={handleChange}
              name='email'
              type='email'
            />
            <InputWithLabel
              label='DNI del titular de la entrada 1'
              value={formData.dni}
              onChange={handleChange}
              name='dni'
              type='number'
            />

            {/* Tickets adicionales */}
            {ticketsCount > 1 && (
              <>
                {Array.from({ length: ticketsCount - 1 }).map((_, index) => (
                  <div
                    key={index}
                    className='space-y-4 mb-4 border-t-3 border-MiExpo_purple/50 pt-4'
                  >
                    <InputWithLabel
                      label={`Nombre y apellido del titular de la entrada ${index + 2}`}
                      value={formData.additionalTickets[index]}
                      onChange={(e) =>
                        handleAdditionalTicketChange(index, e.target.value)
                      }
                      name={`additionalTickets_${index}`}
                    />

                    <InputWithLabel
                      label={`DNI del titular de la entrada ${index + 2}`}
                      value={formData.additionalDnis[index]}
                      onChange={(e) =>
                        handleAdditionalDniChange(index, e.target.value)
                      }
                      name={`additionalDnis_${index}`}
                    />
                  </div>
                ))}
              </>
            )}
            <Separator className='my-8 bg-MiExpo_purple/50' />
            <div className='overflow-hidden mb-3'>
              {/* <Input
                required
                name='referralCode'
                value={formData.referralCode}
                onChange={handleChange}
                type='text'
                placeholder='Código de referido'
                className={cn(
                  'w-full h-10 rounded-[10px] border-2 border-dashed bg-MiExpo_white focus:ring-0 focus:outline-none focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none px-4',
                  isReferralCodeValid.data?.exists === false
                    ? 'border-red-500'
                    : 'border-MiExpo_gray',
                )}
              /> */}
              {errorMessage.length > 0 && (
                <p className='text-red-500 text-sm font-bold mt-1 pl-0.5'>
                  {errorMessage}
                </p>
              )}
            </div>

            <div className='mt-2'>
              <Button
                onClick={handleSubmit}
                disabled={createManyTickets.isPending || isLoadingPdf}
                className='w-full bg-MiExpo_purple hover:bg-MiExpo_purple/90 text-MiExpo_white cursor-pointer py-3 rounded-[10px] font-medium uppercase'
              >
                CONFIRMAR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <BuyTicketsModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        pdfs={pdfData}
      />
    </>
  );
}

export default TicketPurchaseModal;

function InputWithLabel({
  label,
  name,
  onChange,
  value,
  type = 'text',
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: HTMLInputTypeAttribute;
}) {
  return (
    <div className='overflow-hidden'>
      <div className='py-2 bg-white w-3/4 border border-MiExpo_gray rounded-t-[10px] px-3 text-center border-b-0'>
        <p className='text-sm text-center font-medium text-MiExpo_black'>
          {label}
        </p>
      </div>
      <Input
        required
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        className='w-full h-10 rounded-[10px] border border-MiExpo_gray bg-MiExpo_white rounded-tl-none focus:ring-0 focus:outline-none focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none px-4 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
      />
    </div>
  );
}
